import { MAX_TRIP_DAYS } from './trip';
import { datesInRange, TRIP_TYPES, TripType } from './utils';

// What the "new trip" / "edit trip" form submits.
export interface CityInput {
  name: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  timezone: string;
  start_date: string;
  end_date: string;
}

export interface TripInput {
  name: string;
  start_date: string;
  end_date: string;
  home_timezone: string;
  trip_type: TripType;
  cities: CityInput[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_CITIES = 20;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isRealDate(d: string): boolean {
  return DATE_RE.test(d) && !Number.isNaN(new Date(d + 'T12:00:00Z').getTime()) && new Date(d + 'T12:00:00Z').toISOString().startsWith(d);
}

// Returns a human-readable problem, or null if the input is fine. Used by
// the form (instant feedback) and again on the server (never trust the
// browser).
export function validateTripInput(input: TripInput): string | null {
  if (!input.name.trim()) return 'Give your trip a name.';
  if (input.name.trim().length > 100) return 'Trip name is too long (100 characters max).';
  if (!isRealDate(input.start_date) || !isRealDate(input.end_date)) return 'Choose a start and end date.';
  if (input.end_date < input.start_date) return 'The end date can’t be before the start date.';
  if (datesInRange(input.start_date, input.end_date).length > MAX_TRIP_DAYS) {
    return `Trips can be up to ${MAX_TRIP_DAYS} days long.`;
  }
  if (!TRIP_TYPES.includes(input.trip_type)) return 'Choose a trip type.';
  if (!isValidTimeZone(input.home_timezone)) return 'Choose the time zone you’re travelling from.';
  if (input.cities.length === 0) return 'Add at least one destination.';
  if (input.cities.length > MAX_CITIES) return `A trip can have up to ${MAX_CITIES} stops.`;

  for (const c of input.cities) {
    if (!c.name.trim()) return 'Every destination needs a name.';
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180) {
      return `Pick “${c.name}” from the search results so we know where it is.`;
    }
    if (!isValidTimeZone(c.timezone)) return `Pick “${c.name}” from the search results so we know its time zone.`;
    if (!isRealDate(c.start_date) || !isRealDate(c.end_date)) return `Set dates for ${c.name}.`;
    if (c.end_date < c.start_date) return `${c.name}: the end date can’t be before the start date.`;
    if (c.start_date < input.start_date || c.end_date > input.end_date) {
      return `${c.name}: dates must fall within the trip (${input.start_date} to ${input.end_date}).`;
    }
  }
  return null;
}
