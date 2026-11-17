import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import TripForm from '@/components/TripForm';
import { loadTrip } from '@/lib/loaders';
import type { TripInput } from '@/lib/tripInput';

export const metadata = { title: 'Edit trip · Trip Planner' };

export default async function EditTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await loadTrip(tripId);
  if (!trip) notFound();
  // Invited members can plan events but not change the trip itself.
  if (!trip.is_owner) redirect(`/trips/${tripId}`);

  const initial: TripInput = {
    name: trip.name,
    start_date: trip.start_date,
    end_date: trip.end_date,
    home_timezone: trip.home_timezone,
    trip_type: trip.trip_type,
    cities: trip.cities.map((c) => ({
      name: c.name,
      country: c.country,
      country_code: c.country_code,
      lat: c.lat,
      lng: c.lng,
      timezone: c.timezone,
      start_date: c.start_date,
      end_date: c.end_date,
    })),
  };

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link href={`/trips/${tripId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4">
          <ChevronLeft size={15} />
          Back to {trip.name}
        </Link>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Edit trip</h1>
          <TripForm mode="edit" tripId={tripId} initial={initial} />
        </div>
      </div>
    </main>
  );
}
