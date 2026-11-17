import { describe, it, expect } from 'vitest';
import { attractionPlaceholder, hotelPlaceholder } from '@/lib/placeExamples';
import { safeNext, withNext } from '@/lib/safeNext';

describe('placeExamples', () => {
  it('uses a curated landmark for known cities, accent/case-insensitive', () => {
    expect(attractionPlaceholder('Rome')).toBe('e.g. Colosseum');
    expect(attractionPlaceholder('  PRAGUE ')).toBe('e.g. Charles Bridge');
    expect(attractionPlaceholder('Kraków')).toBe('e.g. Wawel Castle');
  });
  it('falls back to a generic example naming the city', () => {
    expect(attractionPlaceholder('Ghent')).toBe('e.g. A museum or landmark in Ghent');
    expect(attractionPlaceholder('')).toBe('e.g. A museum or landmark');
    expect(hotelPlaceholder('Ghent')).toBe('e.g. A place to stay in Ghent');
  });
});

describe('safeNext / withNext', () => {
  it('only allows same-site paths', () => {
    expect(safeNext('/join/abc')).toBe('/join/abc');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext(undefined)).toBe('/');
  });
  it('carries next through links', () => {
    expect(withNext('/signup', '/')).toBe('/signup');
    expect(withNext('/signup', '/join/abc')).toBe('/signup?next=%2Fjoin%2Fabc');
  });
});
