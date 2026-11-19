'use server';

import { createSupabaseServer, getCurrentUser, isSupabaseConfigured } from '@/lib/supabase/server';
import { MAX_PACKING_ITEMS, PackingItem, cleanItemName, missingStarterItems } from '@/lib/packing';
import { normalizeTripType } from '@/lib/utils';

type Result<T = object> = ({ ok: true } & T) | { error: string };

// Your packing list for a trip: your own items plus everything anyone marked
// as shared. Ticks are yours alone. Row Level Security does the filtering.
export async function getPackingItems(tripId: string): Promise<PackingItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabaseServer();
  const user = await getCurrentUser();
  if (!user) return [];
  const [{ data: items }, { data: checks }, { data: people }] = await Promise.all([
    supabase.from('packing_items').select('id, name, shared, created_by, created_at').eq('trip_id', tripId).order('created_at', { ascending: true }),
    supabase.from('packing_checks').select('item_id').eq('user_id', user.id),
    supabase.rpc('get_trip_people', { p_trip: tripId }),
  ]);
  const packed = new Set(((checks ?? []) as { item_id: string }[]).map((c) => c.item_id));
  const names = new Map(((Array.isArray(people) ? people : []) as { user_id: string; display_name: string }[]).map((p) => [p.user_id, p.display_name]));
  return ((items ?? []) as { id: string; name: string; shared: boolean; created_by: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
    shared: r.shared,
    mine: r.created_by === user.id,
    packed: packed.has(r.id),
    addedBy: r.created_by === user.id ? null : names.get(r.created_by) ?? null,
  }));
}

export async function addPackingItem(tripId: string, name: string, shared: boolean): Promise<Result<{ item: PackingItem }>> {
  const clean = cleanItemName(name);
  if (!clean) return { error: 'Type what to pack.' };
  const supabase = await createSupabaseServer();
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in again.' };
  const { count } = await supabase.from('packing_items').select('id', { count: 'exact', head: true }).eq('trip_id', tripId);
  if ((count ?? 0) >= MAX_PACKING_ITEMS) return { error: 'This packing list is full.' };
  const { data, error } = await supabase
    .from('packing_items')
    .insert({ trip_id: tripId, name: clean, shared, created_by: user.id })
    .select('id, name, shared')
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't add that." };
  return { ok: true, item: { id: data.id, name: data.name, shared: data.shared, mine: true, packed: false, addedBy: null } };
}

// Adds the starter ideas for this kind of trip that aren't on your list yet.
export async function addStarterItems(tripId: string): Promise<Result<{ items: PackingItem[] }>> {
  const supabase = await createSupabaseServer();
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in again.' };
  const { data: trip } = await supabase.from('trips').select('trip_type').eq('id', tripId).maybeSingle();
  if (!trip) return { error: "Couldn't find that trip." };
  const existing = await getPackingItems(tripId);
  const toAdd = missingStarterItems(existing.map((i) => i.name), normalizeTripType(trip.trip_type)).slice(0, Math.max(0, MAX_PACKING_ITEMS - existing.length));
  if (toAdd.length === 0) return { ok: true, items: [] };
  const { data, error } = await supabase
    .from('packing_items')
    .insert(toAdd.map((name) => ({ trip_id: tripId, name, shared: false, created_by: user.id })))
    .select('id, name, shared');
  if (error) return { error: error.message };
  return {
    ok: true,
    items: ((data ?? []) as { id: string; name: string; shared: boolean }[]).map((r) => ({ id: r.id, name: r.name, shared: r.shared, mine: true, packed: false, addedBy: null })),
  };
}

export async function setPacked(itemId: string, packed: boolean): Promise<Result> {
  const supabase = await createSupabaseServer();
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in again.' };
  const { error } = packed
    ? await supabase.from('packing_checks').upsert({ item_id: itemId, user_id: user.id })
    : await supabase.from('packing_checks').delete().eq('item_id', itemId).eq('user_id', user.id);
  return error ? { error: error.message } : { ok: true };
}

export async function setItemShared(itemId: string, shared: boolean): Promise<Result> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.from('packing_items').update({ shared }).eq('id', itemId).select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Only the person who added this can change it.' };
  return { ok: true };
}

export async function deletePackingItem(itemId: string): Promise<Result> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.from('packing_items').delete().eq('id', itemId).select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Only the person who added this can remove it.' };
  return { ok: true };
}
