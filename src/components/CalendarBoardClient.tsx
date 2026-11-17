'use client';

import dynamic from 'next/dynamic';
import { Attraction, Hotel } from '@/lib/types';
import { Trip } from '@/lib/trip';
import { DayWeather } from '@/lib/weather';
import { TravelSegment } from '@/lib/travel';
import { TripProvider } from './TripProvider';

const CalendarBoard = dynamic(() => import('./CalendarBoard'));

export default function CalendarBoardClient(props: {
  trip: Trip;
  initialAttractions: Attraction[];
  weather: Record<string, DayWeather[]>;
  travelSegments: Record<string, TravelSegment>;
  initialDayNotes: Record<string, string>;
  initialHotels: Hotel[];
}) {
  const { trip, ...rest } = props;
  return (
    <TripProvider trip={trip}>
      <CalendarBoard {...rest} />
    </TripProvider>
  );
}
