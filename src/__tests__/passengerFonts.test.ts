import { describe, expect, it } from 'vitest';
import { PASSENGER_FONTS, passengerFont } from '@/lib/passengerFonts';

describe('passengerFont', () => {
  it('has six styles', () => expect(PASSENGER_FONTS).toHaveLength(6));
  it('returns the style for an index', () => expect(passengerFont(1)).toBe(PASSENGER_FONTS[1]));
  it('wraps out-of-range, negative and missing indexes safely', () => {
    expect(passengerFont(7)).toBe(PASSENGER_FONTS[1]);
    expect(passengerFont(-1)).toBe(PASSENGER_FONTS[5]);
    expect(passengerFont(undefined)).toBe(PASSENGER_FONTS[0]);
    expect(passengerFont(null)).toBe(PASSENGER_FONTS[0]);
  });
});
