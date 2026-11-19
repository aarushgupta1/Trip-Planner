'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Luggage, Plus, Users, X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { addPackingItem, deletePackingItem, getPackingItems, setItemShared, setPacked } from '@/app/packing/actions';
import { PackingItem, packedCount, sortItems } from '@/lib/packing';

// Each person's packing list. Items marked "shared" show up on everyone's
// list, and ticking one ticks it for everyone (live).
export default function PackingPanel({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [items, setItems] = useState<PackingItem[] | null>(null);
  const [drafts, setDrafts] = useState<{ shared: string; mine: string }>({ shared: '', mine: '' });
  const [error, setError] = useState<string | null>(null);

  // Keeps the screen steady while saving. Every change shows instantly, the
  // saves for one item run strictly in order, and a reload triggered by
  // someone else's (or our own) change is ignored if it could be older than
  // what's on screen. Without this, a reload could land mid-click and flip
  // the checkbox back and forth.
  const itemsRef = useRef<PackingItem[] | null>(null);
  const inFlight = useRef(new Map<string, number>());
  const chains = useRef(new Map<string, Promise<unknown>>());
  const lastWriteDone = useRef(0);
  const needsRefresh = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const busy = () => inFlight.current.size > 0;

  const refresh = useCallback(() => {
    if (busy()) { needsRefresh.current = true; return; }
    const startedAt = Date.now();
    getPackingItems(tripId)
      .then((rows) => {
        // A save started or finished while this was loading: it may be stale.
        if (busy() || startedAt < lastWriteDone.current) { needsRefresh.current = true; return; }
        setItems(rows);
      })
      .catch(() => {});
  }, [tripId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 250);
  }, [refresh]);

  // Run one save for an item after that item's earlier saves have finished.
  const save = <T,>(id: string, fn: () => Promise<T>): Promise<T> => {
    inFlight.current.set(id, (inFlight.current.get(id) ?? 0) + 1);
    const run = (chains.current.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(() => fn().catch(() => ({ error: "Couldn't save that. Try again." }) as unknown as T));
    chains.current.set(id, run);
    const done = () => {
      const left = (inFlight.current.get(id) ?? 1) - 1;
      if (left <= 0) { inFlight.current.delete(id); chains.current.delete(id); } else inFlight.current.set(id, left);
      lastWriteDone.current = Date.now();
      if (!busy() && needsRefresh.current) { needsRefresh.current = false; scheduleRefresh(); }
    };
    return run.finally(done) as Promise<T>;
  };

  useEffect(() => {
    let cancelled = false;
    getPackingItems(tripId)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) { setItems([]); setError("Couldn't load your packing list."); } });
    return () => { cancelled = true; };
  }, [tripId]);

  // Someone else added, changed or ticked an item: reload the list.
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel(`packing-realtime-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packing_items', filter: `trip_id=eq.${tripId}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'packing_items' }, scheduleRefresh)
      .subscribe();
    return () => {
      client.removeChannel(channel);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [tripId, scheduleRefresh]);

  const list = items ?? [];
  const { packed, total } = packedCount(list);
  const sharedItems = sortItems(list.filter((i) => i.shared));
  const mineItems = sortItems(list.filter((i) => !i.shared));

  const update = (id: string, patch: Partial<PackingItem>) => setItems((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const toggle = (item: PackingItem) => {
    // Flip whatever is on screen right now, so quick repeat clicks alternate cleanly.
    const current = itemsRef.current?.find((i) => i.id === item.id)?.packed ?? item.packed;
    const next = !current;
    update(item.id, { packed: next });
    itemsRef.current = (itemsRef.current ?? []).map((i) => (i.id === item.id ? { ...i, packed: next } : i));
    setError(null);
    save(item.id, () => setPacked(item.id, next)).then((r) => {
      // Only undo if nothing newer is waiting on this item.
      if ('error' in r && !inFlight.current.has(item.id)) { update(item.id, { packed: !next }); setError(r.error); }
    });
  };

  const add = (e: React.FormEvent, shared: boolean) => {
    e.preventDefault();
    const field = shared ? 'shared' : 'mine';
    const text = drafts[field];
    if (!text.trim()) return;
    setError(null);
    setDrafts((d) => ({ ...d, [field]: '' }));
    save('new', () => addPackingItem(tripId, text, shared)).then((r) => {
      if ('error' in r) { setError(r.error); setDrafts((d) => ({ ...d, [field]: text })); }
      else setItems((prev) => ((prev ?? []).some((i) => i.id === r.item.id) ? prev : [...(prev ?? []), r.item]));
    });
  };

  const remove = (item: PackingItem) => {
    const before = itemsRef.current;
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    save(item.id, () => deletePackingItem(item.id)).then((r) => {
      if ('error' in r) { setItems(before); setError(r.error); }
    });
  };

  const toggleShared = (item: PackingItem) => {
    const next = !item.shared;
    update(item.id, { shared: next });
    save(item.id, () => setItemShared(item.id, next)).then((r) => {
      if ('error' in r && !inFlight.current.has(item.id)) { update(item.id, { shared: !next }); setError(r.error); }
    });
  };

  const row = (item: PackingItem) => (
    <li key={item.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60">
      <input
        type="checkbox"
        checked={item.packed}
        onChange={() => toggle(item)}
        aria-label={`Packed: ${item.name}`}
        className="h-4 w-4 shrink-0 cursor-pointer"
      />
      <span className={['min-w-0 flex-1 truncate text-sm', item.packed ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'].join(' ')} title={item.name}>
        {item.name}
        {!item.mine && item.addedBy && <span className="ml-1.5 text-[11px] text-gray-400 dark:text-gray-500">· {item.addedBy}</span>}
      </span>
      {item.mine && (
        <>
          <button
            onClick={() => toggleShared(item)}
            title={item.shared ? 'On everyone’s list. Click to move it to just your list' : 'Click to put this on everyone’s list'}
            aria-label={item.shared ? 'Move to just my list' : 'Add to everyone’s list'}
            className={[
              'rounded p-1 transition-colors',
              item.shared
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'text-blue-600 ring-1 ring-blue-600/40 hover:bg-blue-600/10 dark:text-blue-400',
            ].join(' ')}
          >
            <Users size={13} />
          </button>
          {!item.packed && (
            <button onClick={() => remove(item)} aria-label={`Remove ${item.name}`} className="rounded p-1 text-gray-300 hover:text-red-600 dark:text-gray-600 dark:hover:text-red-400">
              <X size={13} />
            </button>
          )}
        </>
      )}
    </li>
  );

  const column = (title: string, hint: string, shared: boolean, rows: PackingItem[]) => {
    const field = shared ? 'shared' : 'mine';
    return (
      <section className="flex min-h-0 flex-col sm:overflow-y-auto" aria-label={title}>
        <div className="px-4 pt-3">
          <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">{title}</h3>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
        </div>
        <form onSubmit={(e) => add(e, shared)} className="px-4 py-2">
          <div className="flex gap-2">
            <input
              value={drafts[field]}
              onChange={(e) => setDrafts((d) => ({ ...d, [field]: e.target.value }))}
              maxLength={120}
              placeholder={shared ? 'Add to everyone’s list…' : 'Add to your list…'}
              aria-label={shared ? 'Add to everyone’s list' : 'Add to your list'}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!drafts[field].trim()}
              aria-label="Add item"
              className="inline-flex items-center rounded-xl bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </form>
        <div className="px-2 pb-4">
          {items === null ? (
            <p className="px-2 py-4 text-sm text-gray-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-4 text-xs text-gray-400 dark:text-gray-500">Nothing here yet.</p>
          ) : (
            <ul>{rows.map(row)}</ul>
          )}
        </div>
      </section>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Luggage size={16} className="text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Packing list</h2>
          {total > 0 && <span className="text-xs text-gray-400 dark:text-gray-500">{packed}/{total} packed</span>}
        </div>
        <button onClick={onClose} aria-label="Close packing list" className="rounded-lg p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <X size={18} />
        </button>
      </div>

      {total > 0 && (
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div className="h-full bg-blue-600 transition-all dark:bg-blue-500" style={{ width: `${(packed / total) * 100}%` }} />
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto sm:grid-cols-2 sm:divide-x sm:divide-gray-100 sm:overflow-hidden dark:sm:divide-gray-800">
        {column('On everyone’s list', 'Shared items.', true, sharedItems)}
        {column('Just mine', 'Only you see these. Click the people icon to share one.', false, mineItems)}
      </div>
      {error && <p className="border-t border-gray-100 px-4 py-2 text-xs font-medium text-red-600 dark:border-gray-800 dark:text-red-400">{error}</p>}
    </>
  );
}
