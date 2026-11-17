import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { getNowInZone } from '@/lib/tripTime';
import { timeToMinutes } from '@/lib/timeUtils';
import { formatTime } from '@/lib/utils';

// Not a page — always run this fresh, never statically cached.
export const dynamic = 'force-dynamic';

const REMINDER_MINUTES = 30;

// This runs from a cron job with nobody signed in, so it has to use the
// service-role key (server-only, bypasses Row Level Security) to see every
// user's upcoming events. It then only ever notifies the devices belonging
// to the user who owns each event's trip.
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // Refuse to run wide open if it's never been configured.

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = request.nextUrl.searchParams.get('secret');
  return querySecret === secret;
}

interface AttractionRow {
  id: string;
  name: string;
  location: string | null;
  scheduled_date: string;
  start_time: string;
  trip_id: string;
  trips: { owner_id: string | null; timezone: string } | { owner_id: string | null; timezone: string }[] | null;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Triggered on a schedule (see vercel.json or supabase/reminders_cron.sql —
// Vercel's Hobby plan only allows daily cron, which isn't frequent enough
// here, so Supabase's pg_cron is the more reliable option for most people).
// Finds every scheduled attraction starting in the next 30 minutes (in its
// own trip's local time) that hasn't already had a reminder sent, and pushes
// a notification to the devices of the user who owns that trip.
function ownerOf(a: AttractionRow): string {
  const trip = Array.isArray(a.trips) ? a.trips[0] : a.trips;
  return trip?.owner_id ?? '';
}

async function handleReminders(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'Push not configured (missing VAPID keys)' }, { status: 500 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const supabase = getSupabase();

  // Trips can be in any time zone, so "today" differs per trip. Fetch a
  // window of calendar dates wide enough to cover every zone, then check
  // each event against its own trip's clock below.
  const nowUtc = new Date();
  const candidateDates = [ymd(new Date(nowUtc.getTime() - 86_400_000)), ymd(nowUtc), ymd(new Date(nowUtc.getTime() + 86_400_000))];

  const { data: attractions, error: attractionsError } = await supabase
    .from('attractions')
    .select('id, name, location, scheduled_date, start_time, trip_id, trips!inner(owner_id, timezone)')
    .in('scheduled_date', candidateDates)
    .not('start_time', 'is', null);

  if (attractionsError) {
    return NextResponse.json({ error: attractionsError.message }, { status: 500 });
  }

  const upcoming = ((attractions ?? []) as unknown as AttractionRow[]).filter((a) => {
    const trip = Array.isArray(a.trips) ? a.trips[0] : a.trips;
    if (!trip || !trip.owner_id) return false; // unclaimed trips have nobody to notify
    const now = getNowInZone(trip.timezone);
    if (a.scheduled_date !== now.date) return false;
    const minutesUntil = timeToMinutes(a.start_time) - now.minutes;
    return minutesUntil >= 0 && minutesUntil <= REMINDER_MINUTES;
  });

  if (upcoming.length === 0) {
    return NextResponse.json({ checked: 0, reminded: 0, pushesSent: 0 });
  }

  const { data: alreadySent } = await supabase
    .from('event_reminders_sent')
    .select('attraction_id')
    .in('attraction_id', upcoming.map((a) => a.id));
  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.attraction_id as string));

  const toRemind = upcoming.filter((a) => !alreadySentIds.has(a.id));
  if (toRemind.length === 0) {
    return NextResponse.json({ checked: upcoming.length, reminded: 0, pushesSent: 0 });
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', [...new Set(toRemind.map((a) => ownerOf(a)))]);
  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  const subs = (subscriptions ?? []) as SubscriptionRow[];
  const invalidSubscriptionIds = new Set<string>();
  let pushesSent = 0;

  for (const attraction of toRemind) {
    const title = `Starting soon: ${attraction.name}`;
    const body = attraction.location
      ? `Starts at ${formatTime(attraction.start_time)} — ${attraction.location}`
      : `Starts at ${formatTime(attraction.start_time)}`;
    const payload = JSON.stringify({ title, body, tag: `event-${attraction.id}`, url: `/trips/${attraction.trip_id}` });

    await Promise.all(
      subs.filter((sub) => sub.user_id === ownerOf(attraction)).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          pushesSent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is gone (browser data cleared, uninstalled, etc.) — prune it.
            invalidSubscriptionIds.add(sub.id);
          }
        }
      })
    );

    // Marked as handled regardless of individual push failures above — the
    // reminder cycle for this attraction has been attempted; we don't want
    // to keep retrying it every cron tick until its start time passes.
    await supabase.from('event_reminders_sent').insert({ attraction_id: attraction.id });
  }

  if (invalidSubscriptionIds.size > 0) {
    await supabase.from('push_subscriptions').delete().in('id', [...invalidSubscriptionIds]);
  }

  return NextResponse.json({
    checked: upcoming.length,
    reminded: toRemind.length,
    pushesSent,
    subscriptionsPruned: invalidSubscriptionIds.size,
  });
}

export async function GET(request: NextRequest) {
  return handleReminders(request);
}

export async function POST(request: NextRequest) {
  return handleReminders(request);
}
