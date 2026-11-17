import { Category, Hotel } from './types';

// Every date from start to end, inclusive — used to expand a hotel's
// check_in/check_out into individual calendar days (see getHotelDates
// below), and by the hotel form to auto-fill its day picker from those two
// fields until the user manually customizes it.
export function datesInRange(start: string, end: string): string[] {
  if (!start) return [];
  if (!end || end < start) return [start];
  const dates: string[] = [];
  const s = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// The trip days a hotel should show up on (day-header badge, distance-from-
// hotel on events). Prefers the explicit assigned_dates list — which can be
// any subset of days, not necessarily contiguous — and falls back to the
// inclusive check_in–check_out range for hotels saved before assigned_dates
// existed, so nothing already saved stops showing up.
export function getHotelDates(hotel: Hotel): string[] {
  if (hotel.assigned_dates.length > 0) return hotel.assigned_dates;
  return datesInRange(hotel.check_in ?? '', hotel.check_out ?? '');
}

export const CATEGORY_COLORS: Record<Category, { bg: string; text: string; border: string; dot: string }> = {
  museum: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-400',
  },
  food: {
    bg: 'bg-rose-50 dark:bg-rose-950',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-400',
  },
  landmark: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-400',
  },
  palace: {
    bg: 'bg-indigo-50 dark:bg-indigo-950',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-400',
  },
  cathedral: {
    bg: 'bg-slate-50 dark:bg-slate-950',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-400',
  },
  tour: {
    bg: 'bg-rose-50 dark:bg-rose-950',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-400',
  },
  entertainment: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-400',
  },
  flights: {
    bg: 'bg-sky-50 dark:bg-sky-950',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    dot: 'bg-sky-400',
  },
  travel: {
    bg: 'bg-cyan-50 dark:bg-cyan-950',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
    dot: 'bg-cyan-400',
  },
  other: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  museum: 'Museum',
  food: 'Food & Dining',
  landmark: 'Landmark',
  palace: 'Palace',
  cathedral: 'Cathedral',
  tour: 'Tour',
  entertainment: 'Entertainment',
  flights: 'Flight',
  travel: 'Travel',
  other: 'Other',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  museum: '🏛️',
  food: '🍽️',
  landmark: '🏰',
  palace: '🏛️',
  cathedral: '⛪',
  tour: '🧭',
  entertainment: '🎭',
  flights: '✈️',
  travel: '🚆',
  other: '📍',
};

// Categories actually offered in the category picker (create/edit modals)
// and the filter menu. "museum" and "food" were removed from this list per
// request — they're kept in the maps above only so any pre-existing event
// still tagged with one of them keeps rendering correctly instead of
// breaking; nobody can pick either of them for new/edited events anymore.
export const SELECTABLE_CATEGORIES: Category[] = [
  'landmark',
  'palace',
  'cathedral',
  'tour',
  'entertainment',
  'flights',
  'travel',
  'other',
];

export function formatDate(dateStr: string): { weekday: string; monthDay: string } {
  const date = new Date(dateStr + 'T12:00:00Z');
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    monthDay: date.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }),
  };
}

export function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Compact "Aug 6" form — used where formatDateFull's "Wednesday, August 6"
// would be too long (e.g. a hotel's check-in/check-out range on a card).
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// "Aug 6 – 16, 2026" / "Dec 28, 2026 – Jan 4, 2027" — for trip cards/headers.
export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  const opts = { timeZone: 'UTC' } as const;
  const month = (d: Date) => d.toLocaleDateString('en-US', { ...opts, month: 'short' });
  const day = (d: Date) => d.toLocaleDateString('en-US', { ...opts, day: 'numeric' });
  const year = (d: Date) => d.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  if (start === end) return `${month(s)} ${day(s)}, ${year(s)}`;
  if (year(s) !== year(e)) return `${month(s)} ${day(s)}, ${year(s)} – ${month(e)} ${day(e)}, ${year(e)}`;
  if (month(s) !== month(e)) return `${month(s)} ${day(s)} – ${month(e)} ${day(e)}, ${year(e)}`;
  return `${month(s)} ${day(s)} – ${day(e)}, ${year(e)}`;
}

// Rough "how long ago" phrasing — used for the offline banner's "last
// synced" note and for "last edited by ___" attribution. Doesn't need to be
// precise to the second, just give a sense of scale.
export function timeAgo(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

// 'local' = the trip destination's wall-clock time (what every event is
// stored and edited in); 'home' = the trip's home timezone, which a flight's
// departure/arrival can be shown in instead (see homeShiftMinutes in
// tripTime.ts for how far apart the two are).
export type CalendarTimezone = 'local' | 'home';

// Shifts a stored "HH:MM" (always destination-local time) into the given
// display timezone, for showing events on the calendar — never for
// editing/saving. `homeShiftMinutes` is how far home time is from local time.
export function shiftTime(timeStr: string, timezone: CalendarTimezone, homeShiftMinutes = 0): string {
  if (timezone !== 'home') return timeStr;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const total = (((hours * 60 + minutes + homeShiftMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatTimeInZone(timeStr: string, timezone: CalendarTimezone, homeShiftMinutes = 0): string {
  return formatTime(shiftTime(timeStr, timezone, homeShiftMinutes));
}

// Google's "universal" maps link — works cross-platform (opens the native
// Maps app on iOS/Android when installed, falls back to Google Maps on the
// web otherwise). Uses the directions action with no origin specified, which
// makes Google Maps default the starting point to the user's current
// location (prompting for location access/a starting point if it isn't
// available) rather than just centering on the destination. Prefers the
// geocoded coordinates; falls back to the raw address text if geocoding
// hasn't produced lat/lng for some reason.
export function getMapsUrl(a: { lat: number | null; lng: number | null; location: string | null }): string | null {
  if (a.lat != null && a.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`;
  }
  if (a.location) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.location)}`;
  }
  return null;
}

type MapPoint = { lat: number | null; lng: number | null; location: string | null };

function mapsParam(p: MapPoint): string | null {
  if (p.lat != null && p.lng != null) return `${p.lat},${p.lng}`;
  if (p.location) return encodeURIComponent(p.location);
  return null;
}

// Same Google Maps directions link as getMapsUrl, but with both ends pinned
// explicitly — used to put the hotel at one end (origin or destination)
// instead of leaving it to default to wherever the user currently is. Works
// from geocoded lat/lng when available, or falls back to the raw address
// text for either end, so it's usable even for a not-yet-saved event that
// hasn't been geocoded yet.
export function getDirectionsUrl(origin: MapPoint, destination: MapPoint): string | null {
  const originParam = mapsParam(origin);
  const destParam = mapsParam(destination);
  if (!originParam || !destParam) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}`;
}

const EARTH_RADIUS_KM = 6371;

// Straight-line ("as the crow flies") distance in km, not a driving/walking
// route — computing an actual route distance would mean calling a routing
// API (a new external dependency, plus usage limits/cost), whereas this
// only needs the lat/lng both sides already have from geocoding. Labeled as
// approximate everywhere it's shown so it isn't mistaken for a real route.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
