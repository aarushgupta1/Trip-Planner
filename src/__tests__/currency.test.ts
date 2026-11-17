import { describe, it, expect } from 'vitest';
import { currencySymbol, defaultCurrencyForCountry } from '@/lib/currency';

describe('currency helpers', () => {
  it('picks a default currency from the trip country', () => {
    expect(defaultCurrencyForCountry('AT')).toBe('EUR');
    expect(defaultCurrencyForCountry('it')).toBe('EUR');
    expect(defaultCurrencyForCountry('JP')).toBe('JPY');
    expect(defaultCurrencyForCountry('CZ')).toBe('CZK');
    expect(defaultCurrencyForCountry('ZZ')).toBe('USD');
    expect(defaultCurrencyForCountry(undefined)).toBe('USD');
  });

  it('shows a symbol when known, otherwise the code', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('XYZ')).toBe('XYZ ');
  });
});
