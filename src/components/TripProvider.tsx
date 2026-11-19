'use client';

import { createContext, useContext, useMemo } from 'react';
import {
  Trip,
  TripCity,
  generateTripDates,
  getCitiesForDate,
  getCityColor,
  getCityForDate,
  formatCityList,
  getCountryCodes,
  nextTripDate,
  effectiveHomeTimezone,
} from '@/lib/trip';
import { homeShiftMinutes, zoneAbbreviation } from '@/lib/tripTime';

interface TripContextValue {
  trip: Trip;
  dates: string[]; // every day of the trip
  cityNames: string; // "Vienna · Salzburg · Prague"
  countryCodes: string[];
  getCityForDate: (date: string) => TripCity;
  getCitiesForDate: (date: string) => TripCity[];
  cityColor: (city: Pick<TripCity, 'name' | 'country_code'>) => { text: string; bg: string; dot: string };
  nextDate: (date: string) => string;
  // How far the trip's home timezone is from the destination's, in minutes,
  // and a short label for it ("EDT") — for flights shown in home time.
  homeShiftMinutes: number;
  homeZoneLabel: string;
}

const TripContext = createContext<TripContextValue | null>(null);

// Makes the current trip (and everything derived from it — its days, which
// city each day is in, time-zone shifts) available to any component below,
// instead of each one assuming one hardcoded vacation.
export function TripProvider({ trip, children }: { trip: Trip; children: React.ReactNode }) {
  const value = useMemo<TripContextValue>(() => {
    const dates = generateTripDates(trip);
    return {
      trip,
      dates,
      cityNames: formatCityList(trip.cities),
      countryCodes: getCountryCodes(trip.cities),
      getCityForDate: (date) => getCityForDate(trip.cities, date),
      getCitiesForDate: (date) => getCitiesForDate(trip.cities, date),
      cityColor: (city) => getCityColor(trip.cities, city),
      nextDate: (date) => nextTripDate(dates, date),
      homeShiftMinutes: homeShiftMinutes(trip.timezone, effectiveHomeTimezone(trip), trip.start_date),
      homeZoneLabel: zoneAbbreviation(effectiveHomeTimezone(trip), trip.start_date),
    };
  }, [trip]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside a <TripProvider>');
  return ctx;
}
