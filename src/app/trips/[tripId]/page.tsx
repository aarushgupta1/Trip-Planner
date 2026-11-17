import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Settings2 } from 'lucide-react';
import { getAttractions, getDayNotes, getHotels } from '@/app/actions';
import { getTrip } from '@/app/trips/actions';
import CalendarBoard from '@/components/CalendarBoardClient';
import ThemeToggle from '@/components/ThemeToggle';
import EditorNameBadge from '@/components/EditorNameBadge';
import PresenceIndicator from '@/components/PresenceIndicator';
import InstallPrompt from '@/components/InstallPrompt';
import UserMenu from '@/components/UserMenu';
import { getCurrentUser } from '@/lib/supabase/server';
import { formatCityList } from '@/lib/trip';
import { formatDateRange } from '@/lib/utils';
import { getWeatherForDates } from '@/lib/weather';
import { getTravelSegments } from '@/lib/travel';

export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  return { title: trip ? `${trip.name} · Trip Planner` : 'Trip Planner' };
}

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) notFound();

  const user = await getCurrentUser();
  const attractions = await getAttractions(tripId);
  const [weather, travelSegments, dayNotes, hotels] = await Promise.all([
    getWeatherForDates(trip),
    getTravelSegments(attractions),
    getDayNotes(tripId),
    getHotels(tripId),
  ]);

  return (
    <main className="h-dvh flex flex-col bg-gray-50 dark:bg-gray-950">
      <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2 px-3 sm:px-5 shrink-0 shadow-sm">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <Link
            href="/"
            title="All trips"
            className="shrink-0 flex items-center p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0">
            <span className="block sm:inline truncate font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
              {formatCityList(trip.cities) || trip.name}
            </span>
            <span className="hidden sm:inline ml-2 text-xs text-gray-400 dark:text-gray-500">
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <InstallPrompt />
          <PresenceIndicator tripId={trip.id} />
          <EditorNameBadge />
          <Link
            href={`/trips/${trip.id}/edit`}
            title="Trip settings"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings2 size={16} />
          </Link>
          <ThemeToggle />
          {user && (
            <UserMenu
              displayName={(user.user_metadata?.full_name as string | undefined) ?? ''}
              email={user.email ?? ''}
            />
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <CalendarBoard
          trip={trip}
          initialAttractions={attractions}
          weather={weather}
          travelSegments={travelSegments}
          initialDayNotes={dayNotes}
          initialHotels={hotels}
        />
      </div>
    </main>
  );
}
