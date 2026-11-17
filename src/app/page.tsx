import Link from 'next/link';
import { Plus, AlertTriangle, Plane } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { getTrips } from '@/app/trips/actions';
import { getCurrentUser, isSupabaseConfigured } from '@/lib/supabase/server';
import { generateTripDates, getCityOrder } from '@/lib/trip';
import TripCard from '@/components/TripCard';
import UserMenu from '@/components/UserMenu';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata = { title: 'My trips · Trip Planner' };

function tripStatus(start: string, end: string, today: string): { label: string; tone: 'live' | 'soon' | 'past' } {
  if (today > end) return { label: 'Past', tone: 'past' };
  if (today >= start) return { label: 'In progress', tone: 'live' };
  const days = Math.round((new Date(start + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86_400_000);
  return { label: days === 1 ? 'Starts tomorrow' : `In ${days} days`, tone: 'soon' };
}

export default async function DashboardPage() {
  const configured = isSupabaseConfigured();
  const user = await getCurrentUser();
  const trips = configured && user ? await getTrips() : [];
  const today = new Date().toISOString().slice(0, 10);

  // Current and upcoming first (soonest first), then past trips (most recent first).
  const current = trips.filter((t) => t.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = trips.filter((t) => t.end_date < today).sort((a, b) => b.start_date.localeCompare(a.start_date));

  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? '';

  const renderCard = (t: (typeof trips)[number]) => (
    <TripCard
      key={t.id}
      id={t.id}
      name={t.name}
      stops={getCityOrder(t.cities).map((c) => ({ name: c.name, country: c.country }))}
      start={t.start_date}
      end={t.end_date}
      days={generateTripDates(t).length}
      status={tripStatus(t.start_date, t.end_date, today)}
      isOwner={t.is_owner}
      passengers={t.people.map((p) => p.display_name)}
      number={t.ticket_no}
      tripType={t.trip_type}
    />
  );

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="font-semibold tracking-tight text-gray-900 dark:text-gray-100">Trip Planner</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && <UserMenu displayName={displayName} email={user.email ?? ''} />}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {!configured && (
          <div className="mb-6 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 text-amber-800 dark:text-amber-300 text-xs">
            <AlertTriangle size={14} className="shrink-0" />
            <span>
              Supabase is not configured. Copy <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded">.env.local.example</code> to{' '}
              <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded">.env.local</code> and add your project credentials.
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {displayName ? `Hi ${displayName.split(' ')[0]}` : 'My trips'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {trips.length === 0 ? 'Where to next?' : 'Pick up where you left off, or start a new adventure.'}
            </p>
          </div>
          <Link
            href="/trips/new"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={15} />
            New trip
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-14 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Plane size={22} />
            </span>
            <p className="font-semibold text-gray-900 dark:text-gray-100">No trips yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choose where you’re going and your dates — we’ll set up a day-by-day planner.
            </p>
            <Link
              href="/trips/new"
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              <Plus size={15} />
              Plan your first trip
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {current.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-500" />
                  Upcoming
                </h2>
                <div className="grid gap-6">{current.map(renderCard)}</div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Past trips</h2>
                <div className="grid gap-6">{past.map(renderCard)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
