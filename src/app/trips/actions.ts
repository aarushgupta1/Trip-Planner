'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';
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

type TripRow = { id: string; name: string; start_date: string; end_date: string; timezone: string; home_timezone: string };

export async function getTrips(): Promise<Trip[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabaseServer();
  const { data: rows, error } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, timezone, home_timezone')
    .order('start_date', { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const { data: cities, error: citiesError } = await supabase
    .from('trip_cities')
    .select('*')
    .in('trip_id', rows.map((r) => r.id));
  if (citiesError) throw new Error(citiesError.message);

  return (rows as TripRow[]).map((row) =>
    toTrip(row, ((cities ?? []) as (TripCity & { trip_id: string })[]).filter((c) => c.trip_id === row.id))
  );
}

// null when the trip doesn't exist *or* isn't yours (RLS makes those look
// identical, which is what we want).
export async function getTrip(id: string): Promise<Trip | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServer();
  const { data: row } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, timezone, home_timezone')
    .eq('id', id)
    .maybeSingle();
  if (!row) return null;
  const { data: cities } = await supabase.from('trip_cities').select('*').eq('trip_id', id);
  return toTrip(row as TripRow, (cities ?? []) as TripCity[]);
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
  const { error } = await supabase
    .from('trips')
    .update({
      name: input.name.trim(),
      start_date: input.start_date,
      end_date: input.end_date,
      timezone: primaryTimezone(input),
      home_timezone: input.home_timezone,
    })
    .eq('id', id);
  if (error) return { error: error.message };

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
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}
