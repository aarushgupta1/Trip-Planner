import type { Trip } from '@/lib/trip';

// The original Vienna / Salzburg / Prague trip, as a fixture — a multi-city
// trip with a day trip (Aug 10: base Salzburg, back to Vienna) and a
// checkout day (Aug 12: Salzburg → Prague) that belong to two cities.
export const LEGACY_TRIP: Trip = {
  id: 'trip-legacy',
  name: 'Vienna, Salzburg & Prague',
  start_date: '2026-08-06',
  end_date: '2026-08-16',
  timezone: 'Europe/Vienna',
  home_timezone: 'America/New_York',
  cities: [
    { id: 'c1', name: 'Vienna', country: 'Austria', country_code: 'AT', lat: 48.2082, lng: 16.3738, timezone: 'Europe/Vienna', start_date: '2026-08-06', end_date: '2026-08-08', position: 0 },
    { id: 'c2', name: 'Salzburg', country: 'Austria', country_code: 'AT', lat: 47.8095, lng: 13.055, timezone: 'Europe/Vienna', start_date: '2026-08-09', end_date: '2026-08-11', position: 1 },
    { id: 'c3', name: 'Prague', country: 'Czech Republic', country_code: 'CZ', lat: 50.0755, lng: 14.4378, timezone: 'Europe/Prague', start_date: '2026-08-12', end_date: '2026-08-16', position: 2 },
    { id: 'c4', name: 'Vienna', country: 'Austria', country_code: 'AT', lat: 48.2082, lng: 16.3738, timezone: 'Europe/Vienna', start_date: '2026-08-10', end_date: '2026-08-10', position: 3 },
    { id: 'c5', name: 'Salzburg', country: 'Austria', country_code: 'AT', lat: 47.8095, lng: 13.055, timezone: 'Europe/Vienna', start_date: '2026-08-12', end_date: '2026-08-12', position: 4 },
  ],
};

// A single-city trip somewhere with no phrasebook, in another hemisphere.
export const SINGLE_CITY_TRIP: Trip = {
  id: 'trip-single',
  name: 'Sydney',
  start_date: '2027-01-03',
  end_date: '2027-01-09',
  timezone: 'Australia/Sydney',
  home_timezone: 'America/Los_Angeles',
  cities: [
    { id: 's1', name: 'Sydney', country: 'Australia', country_code: 'AU', lat: -33.8688, lng: 151.2093, timezone: 'Australia/Sydney', start_date: '2027-01-03', end_date: '2027-01-09', position: 0 },
  ],
};
