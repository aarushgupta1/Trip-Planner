import { describe, it, expect } from 'vitest';
import { getNowInZone, zoneOffsetMinutes, homeShiftMinutes, zoneAbbreviation } from '@/lib/tripTime';

describe('zoneOffsetMinutes', () => {
  it('accounts for daylight saving on the given date', () => {
    expect(zoneOffsetMinutes('Europe/Vienna', new Date('2026-08-06T12:00:00Z'))).toBe(120);
    expect(zoneOffsetMinutes('Europe/Vienna', new Date('2026-12-06T12:00:00Z'))).toBe(60);
    expect(zoneOffsetMinutes('America/New_York', new Date('2026-08-06T12:00:00Z'))).toBe(-240);
  });

  it('handles UTC and half-hour zones', () => {
    expect(zoneOffsetMinutes('UTC', new Date('2026-08-06T12:00:00Z'))).toBe(0);
    expect(zoneOffsetMinutes('Asia/Kolkata', new Date('2026-08-06T12:00:00Z'))).toBe(330);
  });

  it('falls back to 0 for an unknown zone', () => {
    expect(zoneOffsetMinutes('Not/AZone', new Date())).toBe(0);
  });
});

describe('homeShiftMinutes', () => {
  it('is how far home is ahead (+) or behind (−) the destination', () => {
    expect(homeShiftMinutes('Europe/Vienna', 'America/New_York', '2026-08-06')).toBe(-360);
    expect(homeShiftMinutes('America/New_York', 'Europe/Vienna', '2026-08-06')).toBe(360);
    expect(homeShiftMinutes('Asia/Tokyo', 'Asia/Tokyo', '2026-08-06')).toBe(0);
  });
});

describe('getNowInZone', () => {
  it('returns the calendar date and minutes in that zone, not the host zone', () => {
    expect(getNowInZone('Europe/Vienna', new Date('2026-08-06T23:30:00Z'))).toEqual({ date: '2026-08-07', minutes: 90 });
    expect(getNowInZone('America/New_York', new Date('2026-08-06T23:30:00Z'))).toEqual({ date: '2026-08-06', minutes: 19 * 60 + 30 });
  });

  it('treats midnight as 0 minutes, not 24 hours', () => {
    expect(getNowInZone('UTC', new Date('2026-08-06T00:00:00Z'))).toEqual({ date: '2026-08-06', minutes: 0 });
  });
});

describe('zoneAbbreviation', () => {
  it('gives a short label for the zone on that date', () => {
    expect(zoneAbbreviation('America/New_York', '2026-08-06')).toBe('EDT');
    expect(zoneAbbreviation('America/New_York', '2026-12-06')).toBe('EST');
  });
});
