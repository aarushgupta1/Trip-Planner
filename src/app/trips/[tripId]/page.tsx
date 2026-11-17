import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Settings2 } from 'lucide-react';
import { getAttractions, getDayNotes, getHotels } from '@/app/actions';
import { getInviteToken, getTripPeople } from '@/app/trips/actions';
import { loadTrip } from '@/lib/loaders';
import CalendarBoard from '@/components/CalendarBoardClient';
import PresenceIndicator from '@/components/PresenceIndicator';
import ShareTripButton from '@/components/ShareTripButton';
import InstallPrompt from '@/components/InstallPrompt';
import UserMenu from '@/components/UserMenu';
import { getCurrentUser } from '@/lib/supabase/server';
import { formatCityList } from '@/lib/trip';
import { formatDateRange } from '@/lib/utils';
import { isGuideEnabled, isPlaceLookupEnabled } from '@/app/guide/actions';

export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await loadTrip(tripId);
  return { title: trip ? `${trip.name} · Trip Planner` : 'Trip Planner' };
}

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  // Everything below only needs the trip id, so it's all requested at once
  // rather than one after another. (Weather and travel times load after the
  // page appears — see getTripExtras.)
  const [trip, user, attractions, dayNotes, hotels, people] = await Promise.all([
    loadTrip(tripId),
    getCurrentUser(),
    getAttractions(tripId),
    getDayNotes(tripId),
    getHotels(tripId),
    getTripPeople(tripId),
  ]);
  if (!trip) notFound();
  const inviteToken = trip.is_owner ? await getInviteToken(tripId) : null;
  const displayName = (user?.user_metadata?.full_name as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Someone';

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
            <span className="hidden sm:inline ml-2 font-mono text-xs text-blue-600/80 dark:text-blue-400/80">
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <InstallPrompt />
          {user && <PresenceIndicator tripId={trip.id} userId={user.id} name={displayName} />}
          {user && (
            <ShareTripButton
              tripId={trip.id}
              tripName={trip.name}
              dateRange={formatDateRange(trip.start_date, trip.end_date)}
              isOwner={trip.is_owner}
              currentUserId={user.id}
              people={people}
              initialToken={inviteToken}
            />
          )}
          {trip.is_owner && (
            <Link
              href={`/trips/${trip.id}/edit`}
              title="Edit trip settings: name, dates and cities"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Settings2 size={14} />
              <span className="hidden sm:inline">Trip settings</span>
            </Link>
          )}
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
          initialDayNotes={dayNotes}
          initialHotels={hotels}
          guideEnabled={await isGuideEnabled()}
          placesEnabled={await isPlaceLookupEnabled()}
        />
      </div>
    </main>
  );
}
