'use server';

import { getAttractions } from '@/app/actions';
import { getTrip } from '@/app/trips/actions';
import { getTravelSegments, TravelSegment } from '@/lib/travel';
import { DayWeather, getWeatherForDates } from '@/lib/weather';

export interface TripExtras {
  weather: Record<string, DayWeather[]>;
  travelSegments: Record<string, TravelSegment>;
}

// Weather and travel times come from outside services (forecast / history
// APIs and a routing server), which can be slow. They're loaded here, after
// the calendar is already on screen, instead of holding up the page itself.
export async function getTripExtras(tripId: string): Promise<TripExtras> {
  const trip = await getTrip(tripId); // null if it isn't yours — RLS
  if (!trip) return { weather: {}, travelSegments: {} };
  const [weather, travelSegments] = await Promise.all([
    getWeatherForDates(trip).catch(() => ({})),
    getAttractions(tripId)
      .then((attractions) => getTravelSegments(attractions))
      .catch(() => ({})),
  ]);
  return { weather, travelSegments };
}
