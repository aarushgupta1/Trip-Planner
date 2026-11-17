import { describe, it, expect } from 'vitest';
import { barcodeBars, cityCode, formatPassengers } from '@/lib/ticket';

describe('ticket helpers', () => {
  it('makes three-letter city codes', () => {
    expect(cityCode('Vienna')).toBe('VIE');
    expect(cityCode('Prague')).toBe('PRA');
    expect(cityCode('Kraków')).toBe('KRA');
    expect(cityCode('New York')).toBe('NYE');
    expect(cityCode('Ho Chi Minh City')).toBe('HCM');
    expect(cityCode('Ux')).toBe('UXX');
    expect(cityCode('')).toBe('---');
  });
  it('is deterministic per trip id', () => {
    expect(barcodeBars('abc')).toEqual(barcodeBars('abc'));
    expect(barcodeBars('abc')).toHaveLength(30);
    expect(barcodeBars('abc').every((w) => w >= 1 && w <= 3)).toBe(true);
  });
  it('formats passengers with a +N overflow', () => {
    expect(formatPassengers(['Aarush'])).toEqual({ shown: ['Aarush'], more: 0 });
    expect(formatPassengers(['A', 'B', 'C', 'D', 'E'])).toEqual({ shown: ['A', 'B', 'C'], more: 2 });
    expect(formatPassengers(['  ', 'A'])).toEqual({ shown: ['A'], more: 0 });
    expect(formatPassengers([])).toEqual({ shown: [], more: 0 });
  });
});
