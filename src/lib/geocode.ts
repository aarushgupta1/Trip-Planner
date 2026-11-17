export interface GeocodeResult {
  lat: number;
  lng: number;
}

export interface GeocodeSuggestion extends GeocodeResult {
  displayName: string;
}

// Searches are scoped to the countries the trip actually visits (passed in
// by the caller, derived from the trip's cities). Nominatim can't bias toward
// several disjoint cities in one query, so country level is a close proxy
// that still lets addresses/place names resolve correctly within any of
// them. An empty list means "search everywhere".
function countryParam(countryCodes: string[]): string {
  return countryCodes.length > 0 ? `&countrycodes=${countryCodes.join(',')}` : '';
}

// Nominatim (OpenStreetMap) — free, no API key, fair-use policy requires a
// descriptive User-Agent and caps usage at ~1 request/sec, which is fine here
// since this only runs when someone actually saves a location.
export async function geocodeAddress(address: string, countryCodes: string[] = []): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1${countryParam(countryCodes)}`,
      { headers: { 'User-Agent': 'trip-planner (itinerary app)' } }
    );
    if (!res.ok) return null;

    const results = (await res.json()) as { lat: string; lon: string }[];
    if (results.length === 0) return null;

    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

// Powers the location autocomplete field — returns a handful of candidate
// places for a partial, in-progress query.
export async function searchLocations(query: string, countryCodes: string[] = []): Promise<GeocodeSuggestion[]> {
  if (query.trim().length < 3) return [];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5${countryParam(countryCodes)}`,
      { headers: { 'User-Agent': 'trip-planner (itinerary app)' } }
    );
    if (!res.ok) return [];

    const results = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return results.map((r) => ({
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}
