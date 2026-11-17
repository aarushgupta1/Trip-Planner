import { describe, it, expect } from 'vitest';
import { barcodeBars, cityCode, ticketNumber } from '@/lib/ticket';

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
    expect(ticketNumber('abc')).toBe(ticketNumber('abc'));
    expect(ticketNumber('abc')).toMatch(/^\d{4}$/);
    expect(barcodeBars('abc')).toEqual(barcodeBars('abc'));
    expect(barcodeBars('abc')).toHaveLength(30);
    expect(barcodeBars('abc').every((w) => w >= 1 && w <= 3)).toBe(true);
  });
});
