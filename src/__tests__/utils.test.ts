import { describe, it, expect } from 'vitest';
import {
  generateTripDates,
  formatTime,
  formatDate,
  formatDateFull,
  datesInRange,
  getHotelDates,
  distanceKm,
  getDirectionsUrl,
  TRIP_START,
  TRIP_END,
} from '@/lib/utils';
import type { Hotel } from '@/lib/types';

function makeHotel(overrides: Partial<Hotel> = {}): Hotel {
  return {
    id: 'h1',
    name: 'Test Hotel',
    location: null,
    lat: null,
    lng: null,
    check_in: null,
    check_out: null,
    assigned_dates: [],
    price: null,
    currency: 'EUR',
    confirmation_number: null,
    notes: null,
    edited_by: null,
    updated_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe('generateTripDates', () => {
  const dates = generateTripDates();

  it('returns 11 dates (Aug 6 through Aug 16 inclusive)', () => {
    expect(dates).toHaveLength(11);
  });

  it('starts on the trip start date', () => {
    expect(dates[0]).toBe(TRIP_START); // '2026-08-06'
  });

  it('ends on the trip end date', () => {
    expect(dates[dates.length - 1]).toBe(TRIP_END); // '2026-08-16'
  });

  it('each date is exactly one day after the previous', () => {
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T12:00:00Z');
      const curr = new Date(dates[i] + 'T12:00:00Z');
      expect(curr.getTime() - prev.getTime()).toBe(86_400_000); // 24 hours
    }
  });

  it('all entries are in YYYY-MM-DD format', () => {
    expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('formatTime', () => {
  it('formats a morning time correctly', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
  });

  it('formats an afternoon time correctly', () => {
    expect(formatTime('13:30')).toBe('1:30 PM');
  });

  it('formats noon as 12:00 PM', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  it('formats midnight as 12:00 AM', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });

  it('pads single-digit minutes with a leading zero', () => {
    expect(formatTime('10:05')).toBe('10:05 AM');
  });

  it('handles the last minute of the day', () => {
    expect(formatTime('23:59')).toBe('11:59 PM');
  });
});

// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('returns the correct short weekday for 2026-08-06 (Thursday)', () => {
    const { weekday } = formatDate('2026-08-06');
    expect(weekday).toBe('Thu');
  });

  it('returns the numeric day without a month prefix', () => {
    const { monthDay } = formatDate('2026-08-06');
    expect(monthDay).toBe('6');
  });

  it('returns the correct weekday for the last trip day (2026-08-16, Sunday)', () => {
    const { weekday } = formatDate('2026-08-16');
    expect(weekday).toBe('Sun');
  });
});

// ---------------------------------------------------------------------------
describe('formatDateFull', () => {
  it('returns a full human-readable date string', () => {
    const result = formatDateFull('2026-08-06');
    expect(result).toContain('Thursday');
    expect(result).toContain('August');
    expect(result).toContain('6');
  });

  it('does not include the year', () => {
    // The function uses weekday + month + day, no year
    expect(formatDateFull('2026-08-06')).not.toContain('2026');
  });
});

// ---------------------------------------------------------------------------
describe('datesInRange', () => {
  it('returns every date from start to end, inclusive', () => {
    expect(datesInRange('2026-08-09', '2026-08-11')).toEqual(['2026-08-09', '2026-08-10', '2026-08-11']);
  });

  it('returns a single-element array when start and end are the same', () => {
    expect(datesInRange('2026-08-09', '2026-08-09')).toEqual(['2026-08-09']);
  });

  it('falls back to just the start date when end is missing', () => {
    expect(datesInRange('2026-08-09', '')).toEqual(['2026-08-09']);
  });

  it('returns an empty array when start is missing', () => {
    expect(datesInRange('', '2026-08-11')).toEqual([]);
  });

  it('falls back to just the start date when end is before start', () => {
    expect(datesInRange('2026-08-11', '2026-08-09')).toEqual(['2026-08-11']);
  });
});

// ---------------------------------------------------------------------------
describe('getHotelDates', () => {
  it('prefers an explicit assigned_dates list over the check-in/check-out range', () => {
    const hotel = makeHotel({ check_in: '2026-08-09', check_out: '2026-08-11', assigned_dates: ['2026-08-09', '2026-08-12'] });
    expect(getHotelDates(hotel)).toEqual(['2026-08-09', '2026-08-12']);
  });

  it('falls back to the check-in/check-out range when assigned_dates is empty (legacy hotels)', () => {
    const hotel = makeHotel({ check_in: '2026-08-09', check_out: '2026-08-11', assigned_dates: [] });
    expect(getHotelDates(hotel)).toEqual(['2026-08-09', '2026-08-10', '2026-08-11']);
  });

  it('returns an empty array when there is neither assigned_dates nor a date range', () => {
    expect(getHotelDates(makeHotel())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('distanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(distanceKm({ lat: 48.2082, lng: 16.3738 }, { lat: 48.2082, lng: 16.3738 })).toBeCloseTo(0, 5);
  });

  it('returns roughly the known distance between Vienna and Salzburg (~250km)', () => {
    const vienna = { lat: 48.2082, lng: 16.3738 };
    const salzburg = { lat: 47.8095, lng: 13.0550 };
    const km = distanceKm(vienna, salzburg);
    expect(km).toBeGreaterThan(200);
    expect(km).toBeLessThan(300);
  });
});

// ---------------------------------------------------------------------------
describe('getDirectionsUrl', () => {
  it('builds a directions link with both lat/lng ends pinned', () => {
    const url = getDirectionsUrl({ lat: 48.2, lng: 16.3, location: null }, { lat: 48.21, lng: 16.37, location: null });
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&origin=48.2,16.3&destination=48.21,16.37');
  });

  it('falls back to address text when lat/lng is missing on either end', () => {
    const url = getDirectionsUrl({ lat: null, lng: null, location: 'Hotel Sacher Wien' }, { lat: 48.21, lng: 16.37, location: null });
    expect(url).toBe(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('Hotel Sacher Wien')}&destination=48.21,16.37`);
  });

  it('returns null when either end has neither coordinates nor an address', () => {
    expect(getDirectionsUrl({ lat: null, lng: null, location: null }, { lat: 48.21, lng: 16.37, location: null })).toBeNull();
  });
});
