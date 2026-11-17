import { cache } from 'react';
import { getTrip } from '@/app/trips/actions';

// Per-request memoized trip lookup, so a page and its generateMetadata (which
// both need the trip) share one database round trip instead of two.
export const loadTrip = cache((id: string) => getTrip(id));
