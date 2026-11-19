import { Attraction, Hotel } from './types';
import { distanceKm, getHotelDates } from './utils';
import { DEFAULT_DURATION_MINUTES, timeToMinutes } from './timeUtils';

// A free, instant, no-AI review of an itinerary: things that are checkable
// from the data alone (closed days, opening hours, overlaps, tight transfers,
// overloaded or empty days, nights with no hotel). The guide can then explain
// or fix what this finds.

export interface ItineraryIssue {
  severity: 'warn' | 'info';
  date: string; // '' = applies to the whole trip
  message: string;
  attractionIds: string[];
}

const DAY_TOKENS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayIndex(token: string): number {
  return DAY_TOKENS.indexOf(token.slice(0, 3).toLowerCase());
}

export function weekdayOf(date: string): number {
  return new Date(date + 'T12:00:00Z').getUTCDay();
}

const DAY_RE = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*/gi;

// true = closed that weekday, false = open, null = can't tell from the text.
// Understands the usual ways people write it: "Tue–Sun (closed Mondays)",
// "Closed Mon, open Tue-Sun", "Mon-Fri", "daily".
export function isClosedOnWeekday(openDays: string | null, weekday: number): boolean | null {
  if (!openDays || !openDays.trim()) return null;
  const text = openDays.toLowerCase();

  const closedMatch = /closed\s*(?:on)?([^;.)]*?)(?:\bopen\b|[;.)]|$)/.exec(text);
  let closedFound = false;
  if (closedMatch) {
    const days = [...closedMatch[1].matchAll(DAY_RE)].map((m) => dayIndex(m[1]));
    if (days.length > 0) {
      closedFound = true;
      if (days.includes(weekday)) return true;
    }
  }

  const range = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*(?:–|—|-|to)\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*/.exec(text);
  if (range) {
    const from = dayIndex(range[1]);
    const to = dayIndex(range[2]);
    let i = from;
    const open = new Set<number>();
    for (let n = 0; n < 7; n++) {
      open.add(i);
      if (i === to) break;
      i = (i + 1) % 7;
    }
    return !open.has(weekday);
  }

  if (closedFound) return false;
  if (/\b(daily|every day|7 days|seven days)\b/.test(text)) return false;
  return null;
}

// "9:00 AM – 5:00 PM", "09:00-17:30", "9–5 PM" → minutes since midnight.
export function parseOpeningHours(text: string | null): { open: number; close: number } | null {
  if (!text) return null;
  if (/24\s*(h|hours)|all day|always open/i.test(text)) return null;
  const re = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/gi;
  const found: { h: number; m: number; mer: string | null }[] = [];
  for (const m of text.matchAll(re)) {
    const h = Number(m[1]);
    if (h > 24) continue;
    found.push({ h, m: m[2] ? Number(m[2]) : 0, mer: m[3] ? m[3].toLowerCase().replace(/\./g, '') : null });
    if (found.length === 2) break;
  }
  if (found.length < 2) return null;
  const to24 = (t: { h: number; m: number }, mer: string | null) => {
    let h = t.h % 12;
    if (mer === 'pm') h += 12;
    if (!mer) h = t.h; // 24-hour style
    return h * 60 + t.m;
  };
  const [a, b] = found;
  const close = to24(b, b.mer);
  let open = to24(a, a.mer ?? b.mer);
  if (!a.mer && b.mer && open >= close) open = to24(a, 'am');
  if (close <= open) return null;
  return { open, close };
}

function fmt(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

function formatDay(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  return `${DAY_NAMES[d.getUTCDay()].slice(0, 3)} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

const TRAVEL_CATEGORIES = new Set(['flights', 'travel']);
const SPEED_MIN_PER_KM = 4; // rough door-to-door city pace
const TRANSFER_BUFFER_MIN = 10;
const BUSY_EVENT_COUNT = 6;
const BUSY_MINUTES = 10 * 60;

export function checkItinerary(input: { dates: string[]; attractions: Attraction[]; hotels: Hotel[] }): ItineraryIssue[] {
  const { dates, attractions, hotels } = input;
  const issues: ItineraryIssue[] = [];

  for (const date of dates) {
    const day = attractions.filter((a) => a.scheduled_date === date);
    const weekday = weekdayOf(date);

    // Closed days and opening hours
    for (const a of day) {
      if (TRAVEL_CATEGORIES.has(a.category)) continue;
      if (isClosedOnWeekday(a.open_days, weekday) === true) {
        issues.push({
          severity: 'warn',
          date,
          message: `${a.name} may be closed on ${DAY_NAMES[weekday]}s (${a.open_days}).`,
          attractionIds: [a.id],
        });
        continue;
      }
      const hours = parseOpeningHours(a.opening_hours);
      if (hours && a.start_time) {
        const start = timeToMinutes(a.start_time);
        const end = a.end_time ? timeToMinutes(a.end_time) : start;
        if (start < hours.open) {
          issues.push({ severity: 'warn', date, message: `${a.name} starts before it opens (opens ${fmt(hours.open)}).`, attractionIds: [a.id] });
        } else if (start >= hours.close || end > hours.close) {
          issues.push({ severity: 'warn', date, message: `${a.name} runs past closing time (closes ${fmt(hours.close)}).`, attractionIds: [a.id] });
        }
      }
    }

    // Overlaps and tight transfers between consecutive timed events
    const timed = day
      .filter((a) => a.start_time)
      .map((a) => {
        const start = timeToMinutes(a.start_time!);
        const end = a.end_time ? timeToMinutes(a.end_time) : start + DEFAULT_DURATION_MINUTES;
        return { a, start, end };
      })
      .sort((x, y) => x.start - y.start);

    for (let i = 0; i < timed.length - 1; i++) {
      const cur = timed[i];
      const next = timed[i + 1];
      const ids = [cur.a.id, next.a.id];
      if (cur.end > next.start) {
        issues.push({ severity: 'warn', date, message: `${cur.a.name} overlaps with ${next.a.name}.`, attractionIds: ids });
        continue;
      }
      if (TRAVEL_CATEGORIES.has(cur.a.category) || TRAVEL_CATEGORIES.has(next.a.category)) continue;
      if (cur.a.lat != null && cur.a.lng != null && next.a.lat != null && next.a.lng != null) {
        const km = distanceKm({ lat: cur.a.lat, lng: cur.a.lng }, { lat: next.a.lat, lng: next.a.lng });
        const gap = next.start - cur.end;
        const needed = Math.round(km * SPEED_MIN_PER_KM + TRANSFER_BUFFER_MIN);
        if (km >= 1 && gap < needed) {
          issues.push({
            severity: 'warn',
            date,
            message: `Only ${gap} min between ${cur.a.name} and ${next.a.name}, which are about ${km.toFixed(1)} km apart (allow ~${needed} min).`,
            attractionIds: ids,
          });
        }
      }
    }

    // Overloaded or empty days
    const scheduledMinutes = timed.reduce((n, t) => n + (t.end - t.start), 0);
    if (timed.length >= BUSY_EVENT_COUNT || scheduledMinutes > BUSY_MINUTES) {
      issues.push({
        severity: 'info',
        date,
        message: `Busy day: ${timed.length} timed events (${Math.round(scheduledMinutes / 60)} hours scheduled). Consider leaving some slack.`,
        attractionIds: timed.map((t) => t.a.id),
      });
    }
    if (day.length === 0) {
      issues.push({ severity: 'info', date, message: 'Nothing planned yet.', attractionIds: [] });
    }
  }

  // Nights without a hotel (the last day has no night)
  if (hotels.length === 0) {
    if (dates.length > 1) issues.push({ severity: 'info', date: '', message: 'No lodgings added yet.', attractionIds: [] });
  } else {
    const covered = new Set(hotels.flatMap((h) => getHotelDates(h)));
    for (const date of dates.slice(0, -1)) {
      if (!covered.has(date)) {
        issues.push({ severity: 'info', date, message: `No lodging assigned for the night of ${formatDay(date)}.`, attractionIds: [] });
      }
    }
  }

  const order = (i: ItineraryIssue) => (i.date === '' ? '9999' : i.date);
  return issues.sort(
    (a, b) => order(a).localeCompare(order(b)) || (a.severity === b.severity ? 0 : a.severity === 'warn' ? -1 : 1)
  );
}
