'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { getAttractions, getDayNotes, getHotels } from '@/app/actions';
import { getTrip } from '@/app/trips/actions';
import { generateTripDates } from '@/lib/trip';
import { getWeatherForDates } from '@/lib/weather';
import { checkItinerary } from '@/lib/itineraryCheck';
import { formatPlaceForModel, lookupPlace } from '@/lib/places';
import {
  GuideMessage,
  GuideSuggestion,
  LOOKUP_PLACE_TOOL,
  SUGGEST_EVENTS_TOOL,
  buildGuideContext,
  buildGuideSystemPrompt,
  parseSuggestions,
  validateGuideMessages,
} from '@/lib/guide';

const DEFAULT_MODEL = 'claude-haiku-5-5';
const DEFAULT_DAILY_LIMIT = 40;
// Everyone combined, per UTC day — a ceiling on total spend. Tunable per deployment.
const DEFAULT_GLOBAL_DAILY_LIMIT = 300;
const MAX_OUTPUT_TOKENS = 2000;
// Live lookups cost real money, so each answer is capped. Tunable per deployment.
const DEFAULT_MAX_LOOKUPS = 3;
const MAX_TOOL_ROUNDS = 4;

// `checked` lists places whose facts were looked up live for this answer.
export type GuideResult = { reply: string; suggestions: GuideSuggestion[]; checked: string[] } | { error: string };

export async function isGuideEnabled(): Promise<boolean> {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function isPlaceLookupEnabled(): Promise<boolean> {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

// One turn of the chat. Everything the model sees about the trip is re-read
// from the database here (as the signed-in user, so Row Level Security
// applies) — never taken from the browser — and the API key never leaves the
// server.
export async function askGuide(tripId: string, rawMessages: GuideMessage[]): Promise<GuideResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: 'Aero isn’t set up yet (missing ANTHROPIC_API_KEY on the server).' };

  const messages = validateGuideMessages(rawMessages);
  if (!messages) return { error: 'Something was off with that message — try again.' };

  const trip = await getTrip(tripId);
  if (!trip) return { error: "You don't have access to this trip." };

  const supabase = await createSupabaseServer();
  const limit = Number(process.env.GUIDE_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const globalLimit = Number(process.env.GUIDE_GLOBAL_DAILY_LIMIT) || DEFAULT_GLOBAL_DAILY_LIMIT;
  const { data: usage, error: limitError } = await supabase.rpc('bump_guide_usage', {
    p_limit: limit,
    p_global_limit: globalLimit,
  });
  if (limitError) return { error: 'Aero is unavailable right now.' };
  if (usage === 'global_limit') {
    return { error: 'Aero has hit its daily limit across all users and is resting until tomorrow (UTC). The rest of the app still works.' };
  }
  if (usage !== 'ok') return { error: `You've reached today's limit of ${limit} questions to Aero. It resets tomorrow (UTC).` };

  const dates = generateTripDates(trip);
  const [attractions, hotels, dayNotes, weather] = await Promise.all([
    getAttractions(tripId),
    getHotels(tripId),
    getDayNotes(tripId),
    getWeatherForDates(trip).catch(() => ({})),
  ]);
  const issues = checkItinerary({ dates, attractions, hotels });
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  const lookupEnabled = !!placesKey;
  const system = buildGuideSystemPrompt(buildGuideContext({ trip, attractions, hotels, dayNotes, weather, issues }), { lookupEnabled });
  const maxLookups = Number(process.env.GUIDE_MAX_LOOKUPS) || DEFAULT_MAX_LOOKUPS;

  type Block = { type: string; id?: string; text?: string; name?: string; input?: unknown };
  type ApiMessage = { role: 'user' | 'assistant'; content: string | unknown[] };
  type Outcome = { ok: true; blocks: Block[]; stopReason: string | null } | { ok: false; error: string };

  const call = async (history: ApiMessage[], opts: { withTools: boolean }): Promise<Outcome> => {
    const tools: unknown[] = [];
    if (opts.withTools) tools.push(SUGGEST_EVENTS_TOOL);
    if (opts.withTools && lookupEnabled) tools.push(LOOKUP_PLACE_TOOL);
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.GUIDE_MODEL || DEFAULT_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: history,
          ...(tools.length ? { tools } : {}),
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      return { ok: false, error: "Couldn't reach Aero — check your connection and try again." };
    }
    if (!res.ok) {
      // Details stay in the server log; the user gets a plain message.
      console.error('Aero request failed', res.status, await res.text().catch(() => ''));
      return {
        ok: false,
        error: res.status === 429 ? 'Aero is busy right now — try again in a moment.' : 'Aero ran into a problem. Try again.',
      };
    }
    const data = (await res.json()) as { content?: Block[]; stop_reason?: string };
    return { ok: true, blocks: data.content ?? [], stopReason: data.stop_reason ?? null };
  };

  const textOf = (blocks: Block[]) =>
    blocks
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('\n\n')
      .trim();
  const suggestionsOf = (blocks: Block[]) =>
    blocks
      .filter((b) => b.type === 'tool_use' && b.name === SUGGEST_EVENTS_TOOL.name)
      .flatMap((b) => parseSuggestions(b.input, dates));

  // The conversation, extended each time Aero asks to look something up: its
  // request goes in, the live result comes back, and it continues.
  const history: ApiMessage[] = [...messages];
  const suggestions: GuideSuggestion[] = [];
  const checked: string[] = [];
  let lookups = 0;
  let reply = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const out = await call(history, { withTools: true });
    if (!out.ok) return { error: out.error };
    suggestions.push(...suggestionsOf(out.blocks));
    const text = textOf(out.blocks);
    if (text) reply = text;

    const lookupCalls = out.blocks.filter((b) => b.type === 'tool_use' && b.name === LOOKUP_PLACE_TOOL.name);
    if (out.stopReason !== 'tool_use' || lookupCalls.length === 0 || !placesKey) break;

    const results = await Promise.all(
      out.blocks
        .filter((b) => b.type === 'tool_use')
        .map(async (b) => {
          if (b.name !== LOOKUP_PLACE_TOOL.name) {
            return { type: 'tool_result', tool_use_id: b.id, content: 'Shown to the user.' };
          }
          if (lookups >= maxLookups) {
            return { type: 'tool_result', tool_use_id: b.id, content: 'Lookup limit reached for this answer. Use what you already have.' };
          }
          lookups++;
          const query = String((b.input as { query?: unknown } | undefined)?.query ?? '');
          const place = await lookupPlace(query, placesKey);
          if (place) checked.push(place.name);
          return {
            type: 'tool_result',
            tool_use_id: b.id,
            content: place ? formatPlaceForModel(place) : `No result found for "${query}". Say you could not confirm it.`,
          };
        })
    );
    history.push({ role: 'assistant', content: out.blocks });
    history.push({ role: 'user', content: results });
  }

  // The model sometimes answers with only a tool call (or one that held no
  // usable events) and no text. Ask again without tools so a plain answer
  // always comes back, e.g. for "is my plan too packed?".
  if (!reply) {
    console.warn('Aero gave no text; retrying without tools');
    const second = await call([...messages], { withTools: false });
    if (!second.ok) return { error: second.error };
    reply = textOf(second.blocks);
    if (!reply) console.error('Aero returned no text on retry', second.stopReason, second.blocks.map((b) => b.type));
  }

  if (!reply && suggestions.length === 0) return { error: 'Aero had nothing to add — try rephrasing.' };
  return { reply: reply || 'Here are some ideas:', suggestions: suggestions.slice(0, 6), checked: [...new Set(checked)] };
}
