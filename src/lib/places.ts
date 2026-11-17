// Live place facts for the Aero guide, from Google's Places API (New).
// Used only server-side, with a key that never reaches the browser.

export interface PlaceInfo {
  name: string;
  address: string;
  status: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | 'UNKNOWN';
  openNow: boolean | null; // computed by Google in the place's own local time
  weekHours: string[]; // e.g. "Monday: 9:00 AM – 5:00 PM", one line per day
  rating: number | null;
  ratingCount: number | null;
  priceLevel: string | null; // 'Free' | 'Inexpensive' | 'Moderate' | 'Expensive' | 'Very expensive'
  website: string | null;
  mapsUrl: string | null;
}

const PRICE_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: 'Inexpensive',
  PRICE_LEVEL_MODERATE: 'Moderate',
  PRICE_LEVEL_EXPENSIVE: 'Expensive',
  PRICE_LEVEL_VERY_EXPENSIVE: 'Very expensive',
};

// Only what's needed — Google bills by the fields asked for.
export const PLACE_FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.businessStatus',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.currentOpeningHours.openNow',
  'places.currentOpeningHours.weekdayDescriptions',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.websiteUri',
  'places.googleMapsUri',
].join(',');

type RawPlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  googleMapsUri?: string;
};

// First result of a Text Search response → PlaceInfo (null if nothing found).
export function parsePlaceResponse(json: unknown): PlaceInfo | null {
  const places = (json as { places?: RawPlace[] } | null)?.places;
  const p = Array.isArray(places) ? places[0] : undefined;
  if (!p || !p.displayName?.text) return null;
  const status = ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(p.businessStatus ?? '')
    ? (p.businessStatus as PlaceInfo['status'])
    : 'UNKNOWN';
  return {
    name: p.displayName.text,
    address: p.formattedAddress ?? '',
    status,
    openNow: typeof p.currentOpeningHours?.openNow === 'boolean' ? p.currentOpeningHours.openNow : null,
    // currentOpeningHours already reflects holiday changes for the next week.
    weekHours: p.currentOpeningHours?.weekdayDescriptions ?? p.regularOpeningHours?.weekdayDescriptions ?? [],
    rating: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    priceLevel: p.priceLevel ? (PRICE_LABELS[p.priceLevel] ?? null) : null,
    website: p.websiteUri ?? null,
    mapsUrl: p.googleMapsUri ?? null,
  };
}

// Compact text for the model to read.
export function formatPlaceForModel(p: PlaceInfo): string {
  const lines = [`${p.name} — ${p.address}`];
  if (p.status === 'CLOSED_PERMANENTLY') lines.push('Status: PERMANENTLY CLOSED');
  else if (p.status === 'CLOSED_TEMPORARILY') lines.push('Status: temporarily closed');
  if (p.openNow !== null) lines.push(`Open right now: ${p.openNow ? 'yes' : 'no'} (place's local time)`);
  if (p.weekHours.length) lines.push('Hours:', ...p.weekHours.map((h) => `  ${h}`));
  else lines.push('Hours: not listed');
  if (p.rating !== null) lines.push(`Rating: ${p.rating}/5${p.ratingCount ? ` (${p.ratingCount} reviews)` : ''}`);
  if (p.priceLevel) lines.push(`Price level: ${p.priceLevel}`);
  if (p.website) lines.push(`Website: ${p.website}`);
  return lines.join('\n');
}

// One lookup. Returns null if the place isn't found or the service fails —
// callers just tell the model nothing was found, so the guide degrades to
// general knowledge instead of erroring.
export async function lookupPlace(query: string, apiKey: string): Promise<PlaceInfo | null> {
  const q = query.trim().slice(0, 200);
  if (!q) return null;
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACE_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 1, languageCode: 'en' }),
      // Live data: never served from the framework's cache. (Google's terms
      // also limit how long place details may be stored.)
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error('Places lookup failed', res.status, await res.text().catch(() => ''));
      return null;
    }
    return parsePlaceResponse(await res.json());
  } catch {
    return null;
  }
}
