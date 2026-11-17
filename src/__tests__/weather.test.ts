import { describe, it, expect } from 'vitest';
import { addDaysISO, averageReadings, shiftYear, weatherSourceFor, weatherKindLabel } from '@/lib/weather';

describe('weatherSourceFor', () => {
  const today = '2026-11-17';
  it('uses forecast for today and the next 15 days', () => {
    expect(weatherSourceFor('2026-11-17', today)).toBe('forecast');
    expect(weatherSourceFor('2026-12-02', today)).toBe('forecast');
  });
  it('uses typical beyond the forecast window', () => {
    expect(weatherSourceFor('2026-12-03', today)).toBe('typical');
    expect(weatherSourceFor('2027-08-06', today)).toBe('typical');
  });
  it('uses forecast endpoint for recent past and archive for older', () => {
    expect(weatherSourceFor('2026-10-01', today)).toBe('forecast');
    expect(weatherSourceFor('2026-01-01', today)).toBe('archive');
  });
});

describe('helpers', () => {
  it('adds days across month/year', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('shifts years and rejects invalid leap days', () => {
    expect(shiftYear('2028-02-29', 2024)).toBe('2024-02-29');
    expect(shiftYear('2028-02-29', 2025)).toBeNull();
    expect(shiftYear('2027-08-06', 2020)).toBe('2020-08-06');
  });
  it('averages temps and picks the most common code', () => {
    expect(
      averageReadings([
        { high: 80, low: 60, code: 0 },
        { high: 90, low: 70, code: 61 },
        { high: 85, low: 65, code: 61 },
      ])
    ).toEqual({ high: 85, low: 65, code: 61 });
    expect(averageReadings([])).toBeNull();
  });
  it('labels kinds', () => {
    expect(weatherKindLabel('forecast')).toBe('Forecast');
    expect(weatherKindLabel('typical')).toMatch(/10-year/);
  });
});
