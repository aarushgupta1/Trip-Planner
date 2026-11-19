'use server';

import { createSupabaseServer, getCurrentUser, isSupabaseConfigured } from '@/lib/supabase/server';
import { MAX_PACKING_ITEMS, PackingItem, cleanItemName } from '@/lib/packing';

type Result<T = object> = ({ ok: true } & T) | { error: string };

// Your packing list for a trip: your own items plus everything anyone marked
// as shared. Ticking a shared item ticks it for everyone. Row Level Security
// does the filtering.
export async function getPackingItems(tripId: string): Promise<PackingItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabaseServer();
  const user = await getCurrentUser();
  if (!user) return [];
  const [{ data: items }, { data: people }] = await Promise.all([
    supabase.from('packing_items').select('id, name, shared, packed, created_by, created_at').eq('trip_id', tripId).order('created_at', { ascending: true }),
    supabase.rpc('get_trip_people', { p_trip: tripId }),
  ]);
  const names = new Map(((Array.isArray(people) ? people : []) as { user_id: string; display_name: string }[]).map((p) => [p.user_id, p.display_name]));
  return ((items ?? []) as { id: string; name: string; shared: boolean; packed: boolean; created_by: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
    shared: r.shared,
    mine: r.created_by === user.id,
    packed: r.packed,
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

export async function setPacked(itemId: string, packed: boolean): Promise<Result> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc('set_item_packed', { p_item: itemId, p_packed: packed });
  if (error) return { error: error.message };
  if (!data) return { error: "Couldn't update that item." };
  return { ok: true };
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
