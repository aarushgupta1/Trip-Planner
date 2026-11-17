import { describe, it, expect } from 'vitest';
import { getWordOfDay, languageForCountry } from '@/lib/wordOfDay';
import { LEGACY_TRIP, SINGLE_CITY_TRIP } from './fixtures';

describe('getWordOfDay', () => {
  it('returns German for Vienna and Salzburg days', () => {
    expect(getWordOfDay(LEGACY_TRIP, '2026-08-06')?.language).toBe('German');
    expect(getWordOfDay(LEGACY_TRIP, '2026-08-10')?.language).toBe('German');
  });

  it('returns Czech for Prague days', () => {
    expect(getWordOfDay(LEGACY_TRIP, '2026-08-13')?.language).toBe('Czech');
  });

  it('is deterministic — the same date always returns the same word', () => {
    expect(getWordOfDay(LEGACY_TRIP, '2026-08-07')).toEqual(getWordOfDay(LEGACY_TRIP, '2026-08-07'));
  });

  it('gives different words to different days in the same language run', () => {
    expect(getWordOfDay(LEGACY_TRIP, '2026-08-06')?.word).not.toBe(getWordOfDay(LEGACY_TRIP, '2026-08-07')?.word);
  });

  it('continues the sequence across two cities that share a language', () => {
    expect(getWordOfDay(LEGACY_TRIP, '2026-08-09')?.word).not.toBe(getWordOfDay(LEGACY_TRIP, '2026-08-08')?.word);
  });

  it('falls back gracefully for a date outside the trip', () => {
    expect(() => getWordOfDay(LEGACY_TRIP, '2099-01-01')).not.toThrow();
  });

  it('returns null when there is no phrasebook for the destination', () => {
    expect(getWordOfDay(SINGLE_CITY_TRIP, '2027-01-05')).toBeNull();
  });

  it('maps countries to languages', () => {
    expect(languageForCountry('fr')).toBe('French');
    expect(languageForCountry('JP')).toBe('Japanese');
    expect(languageForCountry('MX')).toBe('Spanish');
    expect(languageForCountry('AU')).toBeNull();
  });
});
