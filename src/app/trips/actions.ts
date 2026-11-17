'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer, getCurrentUser, isSupabaseConfigured } from '@/lib/supabase/server';
import { Trip, TripCity, toTrip } from '@/lib/trip';
import { TripInput, validateTripInput } from '@/lib/tripInput';

export interface CitySuggestion {
  name: string;
  admin1: string; // state / region, '' if unknown
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  timezone: string;
}

// City search for the trip form — Open-Meteo's free geocoding API (no key),
// which conveniently also returns each place's time zone.
export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`,
      { next: { revalidate: 60 * 60 * 24 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: {
        name: string;
        admin1?: string;
        country?: string;
        country_code?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }[];
    };
    return (data.results ?? [])
      .filter((r) => r.timezone)
      .map((r) => ({
        name: r.name,
        admin1: r.admin1 ?? '',
        country: r.country ?? '',
        country_code: (r.country_code ?? '').toUpperCase(),
        lat: r.latitude,
        lng: r.longitude,
        timezone: r.timezone!,
      }));
  } catch {
    return [];
  }
}

type TripRow = { id: string; owner_id: string | null; name: string; start_date: string; end_date: string; timezone: string; home_timezone: string };
const TRIP_COLUMNS = 'id, owner_id, name, start_date, end_date, timezone, home_timezone';

// A trip plus whether the signed-in user owns it (as opposed to having been
// invited). Only owners can edit trip settings, share or delete.
export type SharedTrip = Trip & { is_owner: boolean };

export async function getTrips(): Promise<SharedTrip[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabaseServer();
  // One query for the trips and their stops together.
  const [user, { data: rows, error }] = await Promise.all([
    getCurrentUser(),
    supabase.from('trips').select(`${TRIP_COLUMNS}, trip_cities(*)`).order('start_date', { ascending: true }),
  ]);
  if (error) throw new Error(error.message);

  return ((rows ?? []) as (TripRow & { trip_cities: TripCity[] })[]).map((row) => ({
    ...toTrip(row, row.trip_cities ?? []),
    is_owner: row.owner_id === user?.id,
  }));
}

// null when the trip doesn't exist *or* isn't yours (RLS makes those look
// identical, which is what we want).
export async function getTrip(id: string): Promise<SharedTrip | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServer();
  const [user, { data: row }] = await Promise.all([
    getCurrentUser(),
    supabase.from('trips').select(`${TRIP_COLUMNS}, trip_cities(*)`).eq('id', id).maybeSingle(),
  ]);
  if (!row) return null;
  const r = row as TripRow & { trip_cities: TripCity[] };
  return { ...toTrip(r, r.trip_cities ?? []), is_owner: r.owner_id === user?.id };
}

function cityRows(tripId: string, input: TripInput) {
  // Earliest-starting stops first; ties keep the order they were entered in,
  // so on a day trip the base city (entered first) stays the "primary" one.
  return input.cities
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.start_date.localeCompare(b.c.start_date) || a.i - b.i)
    .map(({ c }, position) => ({
      trip_id: tripId,
      name: c.name.trim(),
      country: c.country,
      country_code: c.country_code.toUpperCase(),
      lat: c.lat,
      lng: c.lng,
      timezone: c.timezone,
      start_date: c.start_date,
      end_date: c.end_date,
      position,
    }));
}

// The calendar runs on the first stop's local time.
function primaryTimezone(input: TripInput): string {
  const first = [...input.cities].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return first.timezone;
}

export async function createTrip(input: TripInput): Promise<{ id: string } | { error: string }> {
  const problem = validateTripInput(input);
  if (problem) return { error: problem };

  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: 'You need to sign in again.' };

  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      owner_id: auth.user.id,
      name: input.name.trim(),
      start_date: input.start_date,
      end_date: input.end_date,
      timezone: primaryTimezone(input),
      home_timezone: input.home_timezone,
    })
    .select('id')
    .single();
  if (error || !trip) return { error: error?.message ?? "Couldn't create the trip." };

  const { error: citiesError } = await supabase.from('trip_cities').insert(cityRows(trip.id, input));
  if (citiesError) {
    await supabase.from('trips').delete().eq('id', trip.id); // don't leave a half-made trip behind
    return { error: citiesError.message };
  }

  revalidatePath('/');
  return { id: trip.id };
}

// Events, hotels and notes are never touched here — if the new dates leave
// some of them outside the trip they're simply not shown until the dates
// include them again.
export async function updateTrip(id: string, input: TripInput): Promise<{ ok: true } | { error: string }> {
  const problem = validateTripInput(input);
  if (problem) return { error: problem };

  const supabase = await createSupabaseServer();
  const { data: updated, error } = await supabase
    .from('trips')
    .update({
      name: input.name.trim(),
      start_date: input.start_date,
      end_date: input.end_date,
      timezone: primaryTimezone(input),
      home_timezone: input.home_timezone,
    })
    .eq('id', id)
    .select('id');
  if (error) return { error: error.message };
  // Row Level Security lets only the owner update, and reports anyone else as
  // "0 rows changed" rather than an error.
  if (!updated || updated.length === 0) return { error: 'Only the trip owner can change trip settings.' };

  // Replace the stops. Not atomic over the API, so keep the old rows to put
  // back if the new ones fail to save — a trip should never end up with none.
  const { data: oldCities } = await supabase.from('trip_cities').select('*').eq('trip_id', id);
  const { error: deleteError } = await supabase.from('trip_cities').delete().eq('trip_id', id);
  if (deleteError) return { error: deleteError.message };
  const { error: insertError } = await supabase.from('trip_cities').insert(cityRows(id, input));
  if (insertError) {
    if (oldCities && oldCities.length > 0) await supabase.from('trip_cities').insert(oldCities);
    return { error: insertError.message };
  }

  revalidatePath('/');
  revalidatePath(`/trips/${id}`);
  return { ok: true };
}

export async function deleteTrip(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServer();
  const { data: deleted, error } = await supabase.from('trips').delete().eq('id', id).select('id');
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) return { error: 'Only the trip owner can delete this trip.' };
  revalidatePath('/');
  return { ok: true };
}

// ---- Sharing ----

export interface TripPerson {
  user_id: string;
  display_name: string;
  is_owner: boolean;
}

export async function getTripPeople(tripId: string): Promise<TripPerson[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc('get_trip_people', { p_trip: tripId });
  return (data ?? []) as TripPerson[];
}

// The current invite token, or null if the trip has no active link (owner only).
export async function getInviteToken(tripId: string): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from('trip_invites').select('token').eq('trip_id', tripId).maybeSingle();
  return (data?.token as string | undefined) ?? null;
}

// Makes a fresh link, which also invalidates any previous one.
export async function createInvite(tripId: string): Promise<{ token: string } | { error: string }> {
  const supabase = await createSupabaseServer();
  const { error: deleteError } = await supabase.from('trip_invites').delete().eq('trip_id', tripId);
  if (deleteError) return { error: deleteError.message };
  const { data, error } = await supabase.from('trip_invites').insert({ trip_id: tripId }).select('token').single();
  if (error || !data) return { error: 'Only the trip owner can create an invite link.' };
  return { token: data.token as string };
}

export async function revokeInvite(tripId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('trip_invites').delete().eq('trip_id', tripId);
  return error ? { error: error.message } : { ok: true };
}

// Owner removing someone, or a member leaving (userId = their own id).
export async function removeMember(tripId: string, userId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Couldn't remove that person." };
  revalidatePath('/');
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

export interface InvitePreview {
  trip_name: string;
  owner_name: string;
  already_member: boolean;
}

export async function previewInvite(token: string): Promise<InvitePreview | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.rpc('preview_invite', { p_token: token });
  const row = Array.isArray(data) ? data[0] : data;
  return (row as InvitePreview | undefined) ?? null;
}

export async function joinTrip(token: string): Promise<{ id: string } | { error: string }> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('join_trip', { p_token: token });
  if (error) return { error: error.message };
  if (!data) return { error: 'This invite link is no longer valid.' };
  revalidatePath('/');
  return { id: data as string };
}
