import { describe, it, expect } from 'vitest';
import {
  generateTripDates,
  nextTripDate,
  getCityForDate,
  getCitiesForDate,
  getCityOrder,
  getCityColor,
  formatCityList,
  getCountryCodes,
  cityKey,
} from '@/lib/trip';
import { LEGACY_TRIP, SINGLE_CITY_TRIP } from './fixtures';

const cities = LEGACY_TRIP.cities;
const names = (list: { name: string }[]) => list.map((c) => c.name);

describe('generateTripDates / nextTripDate', () => {
  it('lists every day of the trip, inclusive', () => {
    const dates = generateTripDates(LEGACY_TRIP);
    expect(dates).toHaveLength(11);
    expect(dates[0]).toBe('2026-08-06');
    expect(dates[10]).toBe('2026-08-16');
  });

  it('works for any date range, including across a year boundary', () => {
    expect(generateTripDates({ start_date: '2026-12-30', end_date: '2027-01-02' })).toEqual([
      '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ]);
  });

  it('returns the following trip day, or the same day at the end / outside the trip', () => {
    const dates = generateTripDates(LEGACY_TRIP);
    expect(nextTripDate(dates, '2026-08-06')).toBe('2026-08-07');
    expect(nextTripDate(dates, '2026-08-16')).toBe('2026-08-16');
    expect(nextTripDate(dates, '2030-01-01')).toBe('2030-01-01');
  });
});

describe('getCityForDate', () => {
  it('returns the single city for an ordinary day', () => {
    expect(getCityForDate(cities, '2026-08-06').name).toBe('Vienna');
    expect(getCityForDate(cities, '2026-08-13').name).toBe('Prague');
  });

  it('returns the based-in city for a day-trip day', () => {
    expect(getCityForDate(cities, '2026-08-10').name).toBe('Salzburg');
  });

  it('returns the arrival city for the Aug 12 transition day', () => {
    expect(getCityForDate(cities, '2026-08-12').name).toBe('Prague');
  });

  it('falls back to the nearest stop for a day no stop covers', () => {
    const gap = [
      { ...cities[0], start_date: '2026-08-06', end_date: '2026-08-07' },
      { ...cities[2], start_date: '2026-08-12', end_date: '2026-08-16' },
    ];
    expect(getCityForDate(gap, '2026-08-08').name).toBe('Vienna');
    expect(getCityForDate(gap, '2026-08-11').name).toBe('Prague');
  });
});

describe('getCitiesForDate', () => {
  it('returns a single-element array for an ordinary day', () => {
    expect(names(getCitiesForDate(cities, '2026-08-06'))).toEqual(['Vienna']);
    expect(names(getCitiesForDate(cities, '2026-08-09'))).toEqual(['Salzburg']);
  });

  it('returns both cities for the day trip, in trip order', () => {
    expect(names(getCitiesForDate(cities, '2026-08-10'))).toEqual(['Vienna', 'Salzburg']);
  });

  it('returns both cities for the Aug 12 transition day, Salzburg before Prague', () => {
    expect(names(getCitiesForDate(cities, '2026-08-12'))).toEqual(['Salzburg', 'Prague']);
  });

  it('does not return duplicate cities', () => {
    const result = getCitiesForDate(cities, '2026-08-10');
    expect(new Set(result.map(cityKey)).size).toBe(result.length);
  });
});

describe('city helpers', () => {
  it('orders distinct cities by first appearance', () => {
    expect(names(getCityOrder(cities))).toEqual(['Vienna', 'Salzburg', 'Prague']);
    expect(formatCityList(cities)).toBe('Vienna · Salzburg · Prague');
  });

  it('gives each city its own colour, and the same city the same colour', () => {
    expect(getCityColor(cities, cities[0])).not.toEqual(getCityColor(cities, cities[1]));
    expect(getCityColor(cities, cities[0])).toEqual(getCityColor(cities, cities[3]));
  });

  it('collects the distinct lower-case country codes', () => {
    expect(getCountryCodes(cities).sort()).toEqual(['at', 'cz']);
    expect(getCountryCodes(SINGLE_CITY_TRIP.cities)).toEqual(['au']);
  });
});
