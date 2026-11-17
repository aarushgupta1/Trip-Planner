import { datesInRange, normalizeTripType, TripType } from './utils';

// A trip is a date range plus one or more stops ("cities"), each with its
// own date range. Everything that used to be hardcoded for one particular
// vacation — which days exist, which city a day belongs to, where to centre
// the weather/map — is derived from these two shapes instead. They mirror
// the `trips` and `trip_cities` tables.

export interface TripCity {
  id: string;
  name: string;
  country: string;
  country_code: string; // ISO 3166-1 alpha-2, upper-case ('' if unknown)
  lat: number;
  lng: number;
  timezone: string; // IANA, e.g. 'Europe/Vienna'
  start_date: string; // YYYY-MM-DD, inclusive
  end_date: string; // YYYY-MM-DD, inclusive
  position: number; // lower = listed first
}

export interface Trip {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  timezone: string; // destination (calendar) timezone
  home_timezone: string; // where the travelers live
  trip_type: TripType;
  cities: TripCity[];
}

export const MAX_TRIP_DAYS = 90;

export function generateTripDates(trip: Pick<Trip, 'start_date' | 'end_date'>): string[] {
  return datesInRange(trip.start_date, trip.end_date);
}

// The trip day right after `date` — used e.g. to label the next scheduled
// event "Tomorrow". Returns the same date if it's the last day (or isn't a
// trip date at all).
export function nextTripDate(dates: string[], date: string): string {
  const idx = dates.indexOf(date);
  if (idx === -1 || idx === dates.length - 1) return date;
  return dates[idx + 1];
}

// Stops can repeat (e.g. a day trip back to a city you've already been
// in), so a "city" for display purposes is identified by name + country,
// not by stop row.
export function cityKey(city: Pick<TripCity, 'name' | 'country_code'>): string {
  return `${city.name}|${city.country_code}`;
}

function byPosition(cities: TripCity[]): TripCity[] {
  return [...cities].sort((a, b) => a.position - b.position || a.start_date.localeCompare(b.start_date));
}

// Distinct cities in order of first appearance — the stable order used for
// day-header badges and colours.
export function getCityOrder(cities: TripCity[]): TripCity[] {
  const seen = new Set<string>();
  const out: TripCity[] = [];
  for (const c of byPosition(cities)) {
    const key = cityKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

const UNKNOWN_CITY: TripCity = {
  id: 'unknown',
  name: '',
  country: '',
  country_code: '',
  lat: 0,
  lng: 0,
  timezone: 'UTC',
  start_date: '',
  end_date: '',
  position: 0,
};

function dayDistance(a: string, b: string): number {
  return Math.abs(new Date(a + 'T12:00:00Z').getTime() - new Date(b + 'T12:00:00Z').getTime()) / 86_400_000;
}

// The stop covering `date`; if a day falls in a gap between stops, the
// nearest stop in time is used so every day always has *a* city.
function stopsForDate(cities: TripCity[], date: string): TripCity[] {
  const sorted = byPosition(cities);
  const matches = sorted.filter((c) => date >= c.start_date && date <= c.end_date);
  if (matches.length > 0 || sorted.length === 0) return matches;
  let best = sorted[0];
  let bestDist = Infinity;
  for (const c of sorted) {
    const d = Math.min(dayDistance(date, c.start_date), dayDistance(date, c.end_date));
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return [best];
}

// The single "primary" city for a date — used anywhere only one city makes
// sense (the map's starting view, word-of-the-day). On a multi-city day this
// is whichever stop is listed first, i.e. where the trip is actually based.
export function getCityForDate(cities: TripCity[], date: string): TripCity {
  return stopsForDate(cities, date)[0] ?? UNKNOWN_CITY;
}

// Every distinct city a date belongs to, in first-appearance order — most
// days return one, but a day trip belongs to more than one.
export function getCitiesForDate(cities: TripCity[], date: string): TripCity[] {
  const stops = stopsForDate(cities, date);
  const order = getCityOrder(cities).map(cityKey);
  const unique = new Map<string, TripCity>();
  for (const s of stops) if (!unique.has(cityKey(s))) unique.set(cityKey(s), s);
  return [...unique.values()].sort((a, b) => order.indexOf(cityKey(a)) - order.indexOf(cityKey(b)));
}

// Small colour accent per city for the day-header badge — kept visually
// distinct from the (unrelated) event-category colours. Full class strings
// (not built dynamically) so Tailwind can see them.
const CITY_PALETTE = [
  { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50', dot: 'bg-blue-400' },
  { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50', dot: 'bg-emerald-400' },
  { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/50', dot: 'bg-purple-400' },
  { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50', dot: 'bg-rose-400' },
  { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', dot: 'bg-amber-400' },
  { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50', dot: 'bg-cyan-400' },
  { text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/50', dot: 'bg-pink-400' },
  { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50', dot: 'bg-indigo-400' },
];

export function getCityColor(cities: TripCity[], city: Pick<TripCity, 'name' | 'country_code'>) {
  const idx = getCityOrder(cities).map(cityKey).indexOf(cityKey(city));
  return CITY_PALETTE[(idx === -1 ? 0 : idx) % CITY_PALETTE.length];
}

// "Vienna · Salzburg · Prague" — for headers and placeholders.
export function formatCityList(cities: TripCity[], separator = ' · '): string {
  return getCityOrder(cities).map((c) => c.name).join(separator);
}

// ISO country codes of every stop — used to keep address search scoped to
// the countries actually being visited.
export function getCountryCodes(cities: TripCity[]): string[] {
  return [...new Set(cities.map((c) => c.country_code.toLowerCase()).filter(Boolean))];
}

// Raw `trips` row joined with its `trip_cities` rows → Trip.
export function toTrip(
  row: { id: string; name: string; start_date: string; end_date: string; timezone: string; home_timezone: string; trip_type?: string | null },
  cities: TripCity[]
): Trip {
  return {
    id: row.id,
    name: row.name,
    start_date: row.start_date,
    end_date: row.end_date,
    timezone: row.timezone,
    home_timezone: row.home_timezone,
    trip_type: normalizeTripType(row.trip_type),
    cities: byPosition(cities),
  };
}
