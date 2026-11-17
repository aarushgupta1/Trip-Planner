'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { getAttractions, getDayNotes, getHotels } from '@/app/actions';
import { getTrip } from '@/app/trips/actions';
import { generateTripDates } from '@/lib/trip';
import { getWeatherForDates } from '@/lib/weather';
import { checkItinerary } from '@/lib/itineraryCheck';
import {
  GuideMessage,
  GuideSuggestion,
  SUGGEST_EVENTS_TOOL,
  buildGuideContext,
  buildGuideSystemPrompt,
  parseSuggestions,
  validateGuideMessages,
} from '@/lib/guide';

const DEFAULT_MODEL = 'claude-haiku-5-5';
const DEFAULT_DAILY_LIMIT = 40;
const MAX_OUTPUT_TOKENS = 1200;

export type GuideResult = { reply: string; suggestions: GuideSuggestion[] } | { error: string };

export async function isGuideEnabled(): Promise<boolean> {
  return !!process.env.ANTHROPIC_API_KEY;
}

// One turn of the chat. Everything the model sees about the trip is re-read
// from the database here (as the signed-in user, so Row Level Security
// applies) — never taken from the browser — and the API key never leaves the
// server.
export async function askGuide(tripId: string, rawMessages: GuideMessage[]): Promise<GuideResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: 'The guide isn’t set up yet (missing ANTHROPIC_API_KEY on the server).' };

  const messages = validateGuideMessages(rawMessages);
  if (!messages) return { error: 'Something was off with that message — try again.' };

  const trip = await getTrip(tripId);
  if (!trip) return { error: "You don't have access to this trip." };

  const supabase = await createSupabaseServer();
  const limit = Number(process.env.GUIDE_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const { data: allowed, error: limitError } = await supabase.rpc('bump_guide_usage', { p_limit: limit });
  if (limitError) return { error: 'The guide is unavailable right now.' };
  if (!allowed) return { error: `You've reached today's limit of ${limit} guide questions. It resets tomorrow (UTC).` };

  const dates = generateTripDates(trip);
  const [attractions, hotels, dayNotes, weather] = await Promise.all([
    getAttractions(tripId),
    getHotels(tripId),
    getDayNotes(tripId),
    getWeatherForDates(trip).catch(() => ({})),
  ]);
  const issues = checkItinerary({ dates, attractions, hotels });
  const system = buildGuideSystemPrompt(buildGuideContext({ trip, attractions, hotels, dayNotes, weather, issues }));

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.GUIDE_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages,
        tools: [SUGGEST_EVENTS_TOOL],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { error: "Couldn't reach the guide — check your connection and try again." };
  }

  if (!res.ok) {
    // Details stay in the server log; the user gets a plain message.
    console.error('Guide request failed', res.status, await res.text().catch(() => ''));
    return { error: res.status === 429 ? 'The guide is busy right now — try again in a moment.' : 'The guide ran into a problem. Try again.' };
  }

  const data = (await res.json()) as { content?: { type: string; text?: string; name?: string; input?: unknown }[] };
  const blocks = data.content ?? [];
  const reply = blocks
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n\n')
    .trim();
  const suggestions = blocks
    .filter((b) => b.type === 'tool_use' && b.name === SUGGEST_EVENTS_TOOL.name)
    .flatMap((b) => parseSuggestions(b.input, dates));

  if (!reply && suggestions.length === 0) return { error: 'The guide had nothing to add — try rephrasing.' };
  return { reply: reply || 'Here are some ideas:', suggestions };
}
