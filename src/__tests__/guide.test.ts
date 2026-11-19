import { describe, it, expect } from 'vitest';
import { isClosedOnWeekday, parseOpeningHours, checkItinerary, weekdayOf } from '@/lib/itineraryCheck';
import { parseSuggestions, validateGuideMessages, buildGuideContext } from '@/lib/guide';
import { LEGACY_TRIP } from './fixtures';
import type { Attraction, Hotel } from '@/lib/types';

const base: Attraction = {
  id: 'a', trip_id: 't', name: 'Place', description: null, category: 'landmark', scheduled_date: '2026-08-06',
  start_time: null, end_time: null, notes: null, location: null, lat: null, lng: null, opening_hours: null,
  open_days: null, ticket_urls: [], edited_by: null, created_by: null, visible_to: null, updated_at: '', created_at: '',
  departure_timezone: 'local', arrival_timezone: 'local',
};
const at = (o: Partial<Attraction>): Attraction => ({ ...base, ...o });

describe('isClosedOnWeekday', () => {
  const MON = 1, TUE = 2, SUN = 0, SAT = 6;
  it('reads "closed Mondays" and ranges', () => {
    expect(isClosedOnWeekday('Tue–Sun (closed Mondays)', MON)).toBe(true);
    expect(isClosedOnWeekday('Tue–Sun (closed Mondays)', TUE)).toBe(false);
    expect(isClosedOnWeekday('Closed Mon, open Tue-Sun', MON)).toBe(true);
    expect(isClosedOnWeekday('Closed Mon, open Tue-Sun', SAT)).toBe(false);
    expect(isClosedOnWeekday('Mon-Fri', SAT)).toBe(true);
    expect(isClosedOnWeekday('Mon-Fri', MON)).toBe(false);
    expect(isClosedOnWeekday('Fri–Mon', SUN)).toBe(false);
    expect(isClosedOnWeekday('Daily', SUN)).toBe(false);
  });
  it('returns null when it cannot tell', () => {
    expect(isClosedOnWeekday('ask at the desk', MON)).toBeNull();
    expect(isClosedOnWeekday(null, MON)).toBeNull();
  });
});

describe('parseOpeningHours', () => {
  it('parses common formats', () => {
    expect(parseOpeningHours('9:00 AM – 5:00 PM')).toEqual({ open: 540, close: 1020 });
    expect(parseOpeningHours('09:00-17:30')).toEqual({ open: 540, close: 1050 });
    expect(parseOpeningHours('9–5 PM')).toEqual({ open: 540, close: 1020 });
    expect(parseOpeningHours('10 am - 6 pm')).toEqual({ open: 600, close: 1080 });
  });
  it('gives up on always-open or unreadable text', () => {
    expect(parseOpeningHours('Open 24 hours')).toBeNull();
    expect(parseOpeningHours('varies')).toBeNull();
    expect(parseOpeningHours(null)).toBeNull();
  });
});

describe('checkItinerary', () => {
  const dates = ['2026-08-06', '2026-08-07']; // Thu, Fri
  const hotel = { id: 'h', name: 'H', assigned_dates: ['2026-08-06'], check_in: null, check_out: null } as unknown as Hotel;

  it('knows the weekday', () => {
    expect(weekdayOf('2026-08-06')).toBe(4);
  });
  it('flags closed days, hours, overlaps, tight transfers', () => {
    const events = [
      at({ id: '1', name: 'Museum', open_days: 'closed Thursdays' }),
      at({ id: '2', name: 'Castle', opening_hours: '10:00 AM – 4:00 PM', start_time: '09:00', end_time: '10:00' }),
      at({ id: '3', name: 'Cafe', start_time: '12:00', end_time: '13:30', lat: 48.2, lng: 16.37 }),
      at({ id: '4', name: 'Park', start_time: '13:00', end_time: '14:00' }),
      at({ id: '5', name: 'Tower', start_time: '15:00', end_time: '16:00', lat: 48.2, lng: 16.37 }),
      at({ id: '6', name: 'Far Gallery', start_time: '16:05', end_time: '17:00', lat: 48.3, lng: 16.5 }),
    ];
    const msgs = checkItinerary({ dates, attractions: events, hotels: [hotel] }).map((i) => i.message);
    expect(msgs.some((m) => m.includes('Museum') && m.includes('closed'))).toBe(true);
    expect(msgs.some((m) => m.includes('Castle') && m.includes('before it opens'))).toBe(true);
    expect(msgs.some((m) => m.includes('Cafe') && m.includes('overlaps'))).toBe(true);
    expect(msgs.some((m) => m.includes('Only 5 min') && m.includes('Far Gallery'))).toBe(true);
  });
  it('flags empty days and nights with no hotel', () => {
    const msgs = checkItinerary({ dates, attractions: [], hotels: [] }).map((i) => i.message);
    expect(msgs).toContain('No lodgings added yet.');
    expect(msgs.filter((m) => m === 'Nothing planned yet.')).toHaveLength(2);
    const withHotel = checkItinerary({ dates: [...dates, '2026-08-08'], attractions: [], hotels: [hotel] }).map((i) => i.message);
    expect(withHotel.some((m) => m.startsWith('No lodging assigned for the night of'))).toBe(true);
  });
});

describe('guide helpers', () => {
  const tripDates = ['2026-08-06', '2026-08-07'];
  it('keeps only well-formed suggestions on trip days', () => {
    const out = parseSuggestions(
      { events: [
        { name: 'Belvedere', date: '2026-08-06', start_time: '10:00', end_time: '09:00', category: 'palace' },
        { name: 'Outside', date: '2026-09-01', category: 'landmark' },
        { name: '', date: '2026-08-06', category: 'landmark' },
        { name: 'Odd', date: '2026-08-07', start_time: '25:99', category: 'nonsense' },
        'junk',
      ] },
      tripDates
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'Belvedere', start_time: '10:00', end_time: '', category: 'palace' });
    expect(out[1]).toMatchObject({ name: 'Odd', start_time: '', category: 'other' });
    expect(parseSuggestions(null, tripDates)).toEqual([]);
  });
  it('validates chat messages', () => {
    expect(validateGuideMessages([])).toBeNull();
    expect(validateGuideMessages([{ role: 'assistant', content: 'hi' }])).toBeNull();
    expect(validateGuideMessages([{ role: 'user', content: '  hi ' }])).toEqual([{ role: 'user', content: 'hi' }]);
    expect(validateGuideMessages([{ role: 'system', content: 'x' }])).toBeNull();
    const long = validateGuideMessages([{ role: 'user', content: 'x'.repeat(5000) }]);
    expect(long![0].content).toHaveLength(2000);
  });
  it('builds context with days, hotels and events', () => {
    const ctx = buildGuideContext({
      trip: LEGACY_TRIP,
      attractions: [at({ name: 'Schönbrunn', start_time: '10:00', end_time: '12:00' })],
      hotels: [],
      dayNotes: { '2026-08-06': 'Arrive late' },
    });
    expect(ctx).toContain('## 2026-08-06');
    expect(ctx).toContain('10:00-12:00 [landmark] Schönbrunn');
    expect(ctx).toContain('Note: Arrive late');
  });
});

import { stripMarkdown } from '@/lib/guide';
describe('stripMarkdown', () => {
  it('removes bold, italics, code and headings but keeps the words', () => {
    expect(stripMarkdown('**Hofburg** is *great*, try `Sacher`.')).toBe('Hofburg is great, try Sacher.');
    expect(stripMarkdown('## Day 1\n- **Cafe** at 9')).toBe('Day 1\n- Cafe at 9');
  });
  it('keeps list dashes and multiplication-style asterisks', () => {
    expect(stripMarkdown('- one\n- two')).toBe('- one\n- two');
    expect(stripMarkdown('2 * 3 = 6')).toBe('2 * 3 = 6');
  });
});
