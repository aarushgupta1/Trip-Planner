import { CalendarTimezone } from './utils';

// "museum" and "food" are kept here (rather than deleted outright) purely so
// any already-existing event still tagged with one of them keeps rendering
// correctly — see SELECTABLE_CATEGORIES in utils.ts for the list actually
// offered in the category picker and filter menu, which excludes both and
// adds "palace" / "cathedral" / "tour" instead.
export type Category = 'museum' | 'food' | 'landmark' | 'palace' | 'cathedral' | 'tour' | 'entertainment' | 'flights' | 'travel' | 'other'
  | 'slopes' | 'lesson' | 'rental' | 'apres' // ski
  | 'beach' | 'water' | 'boat' | 'spa'; // beach

export interface Attraction {
  id: string;
  trip_id: string;
  name: string;
  description: string | null;
  category: Category;
  scheduled_date: string | null; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  end_time: string | null; // HH:MM
  notes: string | null;
  location: string | null; // free-text address, geocoded server-side into lat/lng
  lat: number | null;
  lng: number | null;
  opening_hours: string | null; // free-text, e.g. "9:00 AM – 5:00 PM"
  open_days: string | null; // free-text, e.g. "Tue–Sun (closed Mondays)"
  ticket_urls: string[]; // uploaded ticket files (images/PDFs) in Supabase Storage
  edited_by: string | null; // self-chosen display name of whoever last saved this — no auth, not verified
  updated_at: string;
  created_at: string;
  // For flights: which zone the departure and arrival times each display in
  // — a flight's two ends are naturally in two different zones (e.g. an ET
  // departure landing in a different zone), so these are independent rather than
  // one flag for the whole event. Both default to 'local' and are ignored
  // for non-flight categories.
  departure_timezone: CalendarTimezone;
  arrival_timezone: CalendarTimezone;
}

export interface DayNote {
  date: string; // YYYY-MM-DD
  note: string;
  edited_by: string | null;
  updated_at: string;
}

export type Currency = string; // 3-letter code, e.g. 'EUR' — see lib/currency.ts

export interface Hotel {
  id: string;
  trip_id: string;
  name: string;
  location: string | null; // free-text address, geocoded server-side into lat/lng
  lat: number | null;
  lng: number | null;
  check_in: string | null; // YYYY-MM-DD
  check_out: string | null; // YYYY-MM-DD
  // Which specific trip days this hotel shows up on (calendar day-header
  // badge, distance-from-hotel on events, etc.) — not necessarily the same
  // as the check_in–check_out range: a stay can be flagged for a
  // non-contiguous subset of days, and more than one hotel can list the
  // same day (e.g. comparing two options, or a mid-stay switch). Empty for
  // hotels saved before this existed, in which case callers fall back to
  // the check_in–check_out range — see getHotelDates in lib/utils.ts.
  assigned_dates: string[];
  price: number | null;
  currency: Currency;
  confirmation_number: string | null;
  notes: string | null;
  edited_by: string | null;
  updated_at: string;
  created_at: string;
}
