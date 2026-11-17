'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Attraction, Hotel } from '@/lib/types';
import { Trip } from '@/lib/trip';
import type { TripPerson } from '@/app/trips/actions';
import { getTripExtras, TripExtras } from '@/app/trips/extras';
import { TripProvider } from './TripProvider';

const CalendarBoard = dynamic(() => import('./CalendarBoard'));

export default function CalendarBoardClient(props: {
  trip: Trip;
  initialAttractions: Attraction[];
  initialDayNotes: Record<string, string>;
  initialHotels: Hotel[];
  guideEnabled: boolean;
  placesEnabled: boolean;
  people: TripPerson[];
  currentUserId: string;
}) {
  const { trip, ...rest } = props;
  // Weather and travel times arrive a moment after the calendar itself.
  const [extras, setExtras] = useState<TripExtras>({ weather: {}, travelSegments: {} });
  useEffect(() => {
    let live = true;
    getTripExtras(trip.id)
      .then((e) => {
        if (live) setExtras(e);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [trip.id]);

  return (
    <TripProvider trip={trip}>
      <CalendarBoard {...rest} weather={extras.weather} travelSegments={extras.travelSegments} />
    </TripProvider>
  );
}
