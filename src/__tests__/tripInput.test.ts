import { describe, it, expect } from 'vitest';
import { validateTripInput, TripInput } from '@/lib/tripInput';

const city = {
  name: 'Rome',
  country: 'Italy',
  country_code: 'IT',
  lat: 41.9,
  lng: 12.5,
  timezone: 'Europe/Rome',
  start_date: '2026-09-01',
  end_date: '2026-09-07',
};

const valid: TripInput = {
  name: 'Italy',
  start_date: '2026-09-01',
  end_date: '2026-09-07',
  home_timezone: 'America/New_York',
  cities: [city],
};

describe('validateTripInput', () => {
  it('accepts a well-formed trip', () => {
    expect(validateTripInput(valid)).toBeNull();
  });

  it('requires a name', () => {
    expect(validateTripInput({ ...valid, name: '   ' })).toMatch(/name/i);
  });

  it('requires real start and end dates', () => {
    expect(validateTripInput({ ...valid, start_date: '' })).toMatch(/date/i);
    expect(validateTripInput({ ...valid, end_date: '2026-02-30' })).toMatch(/date/i);
  });

  it('rejects an end date before the start date', () => {
    expect(validateTripInput({ ...valid, end_date: '2026-08-30' })).toMatch(/before/i);
  });

  it('caps trip length', () => {
    expect(validateTripInput({ ...valid, end_date: '2027-06-01' })).toMatch(/days/i);
  });

  it('requires at least one destination', () => {
    expect(validateTripInput({ ...valid, cities: [] })).toMatch(/destination/i);
  });

  it('rejects stops outside the trip dates', () => {
    expect(validateTripInput({ ...valid, cities: [{ ...city, end_date: '2026-09-10' }] })).toMatch(/within the trip/i);
  });

  it('rejects a stop whose end is before its start', () => {
    expect(validateTripInput({ ...valid, cities: [{ ...city, start_date: '2026-09-05', end_date: '2026-09-03' }] })).toMatch(/before/i);
  });

  it('rejects a stop with no usable coordinates or time zone', () => {
    expect(validateTripInput({ ...valid, cities: [{ ...city, lat: NaN }] })).toMatch(/Rome/);
    expect(validateTripInput({ ...valid, cities: [{ ...city, timezone: 'Nope/Nope' }] })).toMatch(/time zone/i);
  });

  it('rejects an unknown home time zone', () => {
    expect(validateTripInput({ ...valid, home_timezone: 'Mars/Olympus' })).toMatch(/time zone/i);
  });

  it('allows overlapping stops (e.g. a day trip)', () => {
    const overlapping = [city, { ...city, name: 'Florence', start_date: '2026-09-03', end_date: '2026-09-03' }];
    expect(validateTripInput({ ...valid, cities: overlapping })).toBeNull();
  });
});
