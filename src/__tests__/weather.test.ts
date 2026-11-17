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

import { averageHourly, parseHourlyBlock } from '@/lib/weather';

describe('hourly weather', () => {
  it('parses an Open-Meteo hourly block', () => {
    const pts = parseHourlyBlock(
      {
        time: ['2026-08-06T00:00', '2026-08-06T13:00', '2026-08-06T14:00'],
        temperature_2m: [60.4, 79.6, null],
        weather_code: [0, 61, 3],
        precipitation_probability: [0, 40.4, 10],
      },
      'chance'
    );
    expect(pts).toEqual([
      { hour: 0, temp: 60, code: 0, rain: { kind: 'chance', value: 0 } },
      { hour: 13, temp: 80, code: 61, rain: { kind: 'chance', value: 40 } },
    ]); // the hour with a missing temperature is dropped
  });
  it('reads rainfall amounts and the older weathercode key', () => {
    const pts = parseHourlyBlock(
      { time: ['2026-08-06T09:00'], temperature_2m: [70], weathercode: [3], precipitation: [0.123] },
      'amount'
    );
    expect(pts[0].rain).toEqual({ kind: 'amount', value: 0.12 });
    expect(parseHourlyBlock(undefined, 'chance')).toEqual([]);
  });
  it('averages the same hour across years', () => {
    const y1 = [{ hour: 9, temp: 70, code: 0, rain: { kind: 'amount' as const, value: 0.1 } }];
    const y2 = [{ hour: 9, temp: 80, code: 61, rain: { kind: 'amount' as const, value: 0.3 } }];
    const y3 = [{ hour: 9, temp: 75, code: 61, rain: { kind: 'amount' as const, value: 0.2 } }];
    expect(averageHourly([y1, y2, y3])).toEqual([{ hour: 9, temp: 75, code: 61, rain: { kind: 'amount', value: 0.2 } }]);
    expect(averageHourly([])).toEqual([]);
  });
});
