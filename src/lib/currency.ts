import type { Currency } from './types';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', INR: '₹', CZK: 'Kč', CHF: 'CHF ',
  CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', MXN: 'MX$', BRL: 'R$', SEK: 'kr ', NOK: 'kr ', DKK: 'kr ',
  PLN: 'zł', HUF: 'Ft ', TRY: '₺', THB: '฿', AED: 'AED ', SGD: 'S$', HKD: 'HK$', ZAR: 'R ',
};

// The currencies offered in the hotel price picker (any 3-letter code is
// accepted by the database; this is just what's listed).
export const CURRENCY_OPTIONS: Currency[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF', 'CZK', 'PLN', 'HUF', 'SEK', 'NOK', 'DKK',
  'MXN', 'BRL', 'INR', 'CNY', 'KRW', 'THB', 'SGD', 'HKD', 'TRY', 'AED', 'ZAR',
];

export function currencySymbol(code: Currency): string {
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

const EURO_COUNTRIES = new Set([
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
]);

const COUNTRY_CURRENCY: Record<string, Currency> = {
  US: 'USD', GB: 'GBP', JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', CZ: 'CZK', CH: 'CHF', CA: 'CAD',
  AU: 'AUD', NZ: 'NZD', MX: 'MXN', BR: 'BRL', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', HU: 'HUF',
  TR: 'TRY', TH: 'THB', AE: 'AED', SG: 'SGD', HK: 'HKD', ZA: 'ZAR',
};

// A sensible default for the hotel price picker, based on where the trip is.
export function defaultCurrencyForCountry(countryCode: string | undefined): Currency {
  const cc = (countryCode ?? '').toUpperCase();
  if (EURO_COUNTRIES.has(cc)) return 'EUR';
  return COUNTRY_CURRENCY[cc] ?? 'USD';
}
