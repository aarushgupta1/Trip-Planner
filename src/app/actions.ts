'use server';

import { revalidatePath } from 'next/cache';
import { Attraction, Category, DayNote, Hotel, Currency } from '@/lib/types';
import { CalendarTimezone } from '@/lib/utils';
import { geocodeAddress, searchLocations as searchLocationsGeo, GeocodeSuggestion } from '@/lib/geocode';
import { createSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';

// Every query below runs as the signed-in user (cookie session), so Row
// Level Security — not just the explicit trip_id filters — keeps each
// person's trips separate.
const getSupabase = createSupabaseServer;

async function getTripCountryCodes(tripId: string): Promise<string[]> {
  const { data } = await (await getSupabase()).from('trip_cities').select('country_code').eq('trip_id', tripId);
  return [...new Set((data ?? []).map((r) => String(r.country_code).toLowerCase()).filter(Boolean))];
}

export async function getAttractions(tripId: string): Promise<Attraction[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await (await getSupabase())
    .from('attractions')
    .select('*')
    .eq('trip_id', tripId)
    .order('start_time', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Attraction[];
}

export async function createAttractionObject(
  data: {
    trip_id: string;
    name: string;
    description: string | null;
    category: Category;
    scheduled_date: string | null;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
    location: string | null;
    opening_hours?: string | null;
    open_days?: string | null;
    departure_timezone?: CalendarTimezone;
    arrival_timezone?: CalendarTimezone;
  },
  editedBy?: string | null
): Promise<Attraction> {
  const geo = data.location ? await geocodeAddress(data.location, await getTripCountryCodes(data.trip_id)) : null;

  const { data: row, error } = await (await getSupabase())
    .from('attractions')
    .insert({
      ...data,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      edited_by: editedBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/');
  return row as Attraction;
}

export async function scheduleAttraction(id: string, scheduledDate: string | null): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('attractions')
    .update({ scheduled_date: scheduledDate })
    .eq('id', id);

  if (error) throw new Error(error.message);
  // The day changed — clear any pending "reminder already sent" record so a
  // rescheduled event gets a fresh 30-minutes-prior notification for its new
  // slot instead of silently staying marked as already reminded.
  await supabase.from('event_reminders_sent').delete().eq('attraction_id', id);
  revalidatePath('/');
}

export async function updateAttraction(
  id: string,
  data: Partial<Pick<Attraction, 'name' | 'description' | 'category' | 'scheduled_date' | 'start_time' | 'end_time' | 'notes' | 'location' | 'opening_hours' | 'open_days' | 'departure_timezone' | 'arrival_timezone'>>,
  editedBy?: string | null
): Promise<void> {
  // Callers only pass `location` when it actually changed, so re-geocoding
  // here doesn't fire on every unrelated edit (e.g. just moving the time).
  const patch: Record<string, unknown> = { ...data, edited_by: editedBy ?? null, updated_at: new Date().toISOString() };
  const supabase = await getSupabase();
  if ('location' in patch) {
    const location = (patch.location as string | null) || null;
    let geo = null;
    if (location) {
      const { data: owner } = await supabase.from('attractions').select('trip_id').eq('id', id).single();
      geo = await geocodeAddress(location, owner?.trip_id ? await getTripCountryCodes(owner.trip_id) : []);
    }
    patch.location = location;
    patch.lat = geo?.lat ?? null;
    patch.lng = geo?.lng ?? null;
  }


  // Some callers (e.g. the edit form) always resend scheduled_date/start_time
  // even when the user didn't touch them, so only clear the "already
  // reminded" record if the day or start time is genuinely changing —
  // otherwise every unrelated edit (description, notes, category…) would
  // reset it and risk a duplicate notification.
  if ('scheduled_date' in patch || 'start_time' in patch) {
    const { data: current } = await supabase
      .from('attractions')
      .select('scheduled_date, start_time')
      .eq('id', id)
      .single();
    const dateChanged = 'scheduled_date' in patch && patch.scheduled_date !== current?.scheduled_date;
    const timeChanged = 'start_time' in patch && patch.start_time !== current?.start_time;
    if (dateChanged || timeChanged) {
      await supabase.from('event_reminders_sent').delete().eq('attraction_id', id);
    }
  }

  const { error } = await supabase.from('attractions').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function searchLocations(query: string, tripId: string): Promise<GeocodeSuggestion[]> {
  return searchLocationsGeo(query, await getTripCountryCodes(tripId));
}

// Returns the deleted row (rather than void) so callers can offer an "Undo"
// that re-inserts it — see restoreAttraction below.
export async function deleteAttraction(id: string): Promise<Attraction> {
  const { data, error } = await (await getSupabase()).from('attractions').delete().eq('id', id).select().single();
  if (error) throw new Error(error.message);
  revalidatePath('/');
  return data as Attraction;
}

// Used only by the "Undo" toast right after a delete — re-inserts the exact
// row (same id and all) so realtime INSERT handling on every device just
// picks it back up like any other new event, no special-casing needed.
export async function restoreAttraction(attraction: Attraction): Promise<Attraction> {
  const { data, error } = await (await getSupabase()).from('attractions').insert(attraction).select().single();
  if (error) throw new Error(error.message);
  revalidatePath('/');
  return data as Attraction;
}

export async function addTicketUrl(id: string, url: string): Promise<void> {
  const supabase = await getSupabase();
  const { data: row, error: fetchError } = await supabase
    .from('attractions')
    .select('ticket_urls')
    .eq('id', id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const ticketUrls = [...((row?.ticket_urls as string[] | null) ?? []), url];
  const { error } = await supabase.from('attractions').update({ ticket_urls: ticketUrls }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function removeTicketUrl(id: string, url: string): Promise<void> {
  const supabase = await getSupabase();
  const { data: row, error: fetchError } = await supabase
    .from('attractions')
    .select('ticket_urls')
    .eq('id', id)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const ticketUrls = ((row?.ticket_urls as string[] | null) ?? []).filter((u) => u !== url);
  const { error } = await supabase.from('attractions').update({ ticket_urls: ticketUrls }).eq('id', id);
  if (error) throw new Error(error.message);

  // Best-effort: also remove the underlying file from storage.
  const marker = '/storage/v1/object/public/tickets/';
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const path = url.slice(idx + marker.length);
    await supabase.storage.from('tickets').remove([path]);
  }

  revalidatePath('/');
}

export async function getDayNotes(tripId: string): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};

  const { data, error } = await (await getSupabase()).from('day_notes').select('date, note').eq('trip_id', tripId);
  if (error) return {};
  return Object.fromEntries(((data ?? []) as DayNote[]).map((row) => [row.date, row.note]));
}

export async function upsertDayNote(tripId: string, date: string, note: string, editedBy?: string | null): Promise<void> {
  const supabase = await getSupabase();

  // Empty notes are deleted rather than stored, so the table doesn't fill
  // up with blank rows for every day that's ever had its note cleared.
  if (note.trim() === '') {
    const { error } = await supabase.from('day_notes').delete().eq('trip_id', tripId).eq('date', date);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('day_notes')
      .upsert(
        { trip_id: tripId, date, note, edited_by: editedBy ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'trip_id,date' }
      );
    if (error) throw new Error(error.message);
  }

  revalidatePath('/');
}

export async function getHotels(tripId: string): Promise<Hotel[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await (await getSupabase())
    .from('hotels')
    .select('*')
    .eq('trip_id', tripId)
    .order('check_in', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Hotel[];
}

export async function createHotel(
  data: {
    trip_id: string;
    name: string;
    location: string | null;
    check_in: string | null;
    check_out: string | null;
    price: number | null;
    currency: Currency;
    confirmation_number: string | null;
    notes: string | null;
    assigned_dates: string[];
  },
  editedBy?: string | null
): Promise<Hotel> {
  const geo = data.location ? await geocodeAddress(data.location, await getTripCountryCodes(data.trip_id)) : null;

  const { data: row, error } = await (await getSupabase())
    .from('hotels')
    .insert({
      ...data,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      edited_by: editedBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/');
  return row as Hotel;
}

export async function updateHotel(
  id: string,
  data: Partial<Pick<Hotel, 'name' | 'location' | 'check_in' | 'check_out' | 'price' | 'currency' | 'confirmation_number' | 'notes' | 'assigned_dates'>>,
  editedBy?: string | null
): Promise<void> {
  // Only re-geocode when the location actually changed, same reasoning as
  // updateAttraction — callers only pass `location` when it's different.
  const patch: Record<string, unknown> = { ...data, edited_by: editedBy ?? null, updated_at: new Date().toISOString() };
  const supabase = await getSupabase();
  if ('location' in patch) {
    const location = (patch.location as string | null) || null;
    let geo = null;
    if (location) {
      const { data: owner } = await supabase.from('hotels').select('trip_id').eq('id', id).single();
      geo = await geocodeAddress(location, owner?.trip_id ? await getTripCountryCodes(owner.trip_id) : []);
    }
    patch.location = location;
    patch.lat = geo?.lat ?? null;
    patch.lng = geo?.lng ?? null;
  }

  const { error } = await supabase.from('hotels').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

// Returns the deleted row (rather than void) so callers can offer an "Undo"
// that re-inserts it — see restoreHotel below.
export async function deleteHotel(id: string): Promise<Hotel> {
  const { data, error } = await (await getSupabase()).from('hotels').delete().eq('id', id).select().single();
  if (error) throw new Error(error.message);
  revalidatePath('/');
  return data as Hotel;
}

// Used only by the "Undo" toast right after a delete — re-inserts the exact
// row (same id and all).
export async function restoreHotel(hotel: Hotel): Promise<Hotel> {
  const { data, error } = await (await getSupabase()).from('hotels').insert(hotel).select().single();
  if (error) throw new Error(error.message);
  revalidatePath('/');
  return data as Hotel;
}

// Registers (or re-registers) this device's push subscription for the
// signed-in user, so /api/send-event-reminders can wake it with a "starts in
// 30 min" notification for that user's trips. Goes through a database
// function (see save_push_subscription in schema.sql) so the same browser
// can be re-registered under a different account.
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  const { error } = await (await getSupabase()).rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
  });
  if (error) throw new Error(error.message);
}

// Called when a device turns event alerts off — removes it from the list
// /api/send-event-reminders sends to, so this device stops getting "starts
// in 30 min" pushes even though the browser-level notification permission
// (which can't be revoked from JS) stays granted.
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await (await getSupabase()).from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}
