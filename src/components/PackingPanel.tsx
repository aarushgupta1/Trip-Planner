'use client';

import { useEffect, useState, useTransition } from 'react';
import { Luggage, Plus, Sparkles, Users, X } from 'lucide-react';
import { addPackingItem, addStarterItems, deletePackingItem, getPackingItems, setItemShared, setPacked } from '@/app/packing/actions';
import { PackingItem, packedCount, sortItems } from '@/lib/packing';
import { TRIP_TYPE_LABELS, TripType } from '@/lib/utils';

// Each person's packing list. Items marked "shared" show up on everyone's
// list; ticks are always your own.
export default function PackingPanel({ tripId, tripType, onClose }: { tripId: string; tripType: TripType; onClose: () => void }) {
  const [items, setItems] = useState<PackingItem[] | null>(null);
  const [name, setName] = useState('');
  const [shareNew, setShareNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getPackingItems(tripId)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) { setItems([]); setError("Couldn't load your packing list."); } });
    return () => { cancelled = true; };
  }, [tripId]);

  const list = items ?? [];
  const { packed, total } = packedCount(list);
  const sharedItems = sortItems(list.filter((i) => i.shared));
  const mineItems = sortItems(list.filter((i) => !i.shared));

  const update = (id: string, patch: Partial<PackingItem>) => setItems((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const toggle = (item: PackingItem) => {
    update(item.id, { packed: !item.packed });
    setError(null);
    startTransition(async () => {
      const r = await setPacked(item.id, !item.packed);
      if ('error' in r) { update(item.id, { packed: item.packed }); setError(r.error); }
    });
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    const text = name;
    setName('');
    startTransition(async () => {
      const r = await addPackingItem(tripId, text, shareNew);
      if ('error' in r) { setError(r.error); setName(text); }
      else setItems((prev) => [...(prev ?? []), r.item]);
    });
  };

  const addIdeas = () => {
    setError(null);
    startTransition(async () => {
      const r = await addStarterItems(tripId);
      if ('error' in r) setError(r.error);
      else setItems((prev) => [...(prev ?? []), ...r.items]);
    });
  };

  const remove = (item: PackingItem) => {
    const before = items;
    setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    startTransition(async () => {
      const r = await deletePackingItem(item.id);
      if ('error' in r) { setItems(before); setError(r.error); }
    });
  };

  const toggleShared = (item: PackingItem) => {
    update(item.id, { shared: !item.shared });
    startTransition(async () => {
      const r = await setItemShared(item.id, !item.shared);
      if ('error' in r) { update(item.id, { shared: item.shared }); setError(r.error); }
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
            title={item.shared ? 'Shared with everyone. Click to keep it just on your list' : 'Add to everyone’s list'}
            aria-label={item.shared ? 'Stop sharing' : 'Share with everyone'}
            className={['rounded p-1 transition-colors', item.shared ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 hover:text-blue-600 dark:text-gray-600 dark:hover:text-blue-400'].join(' ')}
          >
            <Users size={13} />
          </button>
          <button onClick={() => remove(item)} aria-label={`Remove ${item.name}`} className="rounded p-1 text-gray-300 hover:text-red-600 dark:text-gray-600 dark:hover:text-red-400">
            <X size={13} />
          </button>
        </>
      )}
    </li>
  );

  const heading = 'px-2 pb-1 pt-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500';

  return (
    <aside
      className="fixed right-0 top-14 bottom-0 z-40 flex w-full flex-col border-l border-t-2 border-gray-200 border-t-blue-600 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:w-[400px]"
      aria-label="Packing list"
    >
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

      <form onSubmit={add} className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Add something to pack…"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={!name.trim() || isPending}
            aria-label="Add item"
            className="inline-flex items-center rounded-xl bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <input type="checkbox" checked={shareNew} onChange={(e) => setShareNew(e.target.checked)} className="h-3.5 w-3.5" />
          Add to everyone’s list (like a group charger)
        </label>
      </form>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {items === null ? (
          <p className="px-2 py-6 text-sm text-gray-400">Loading…</p>
        ) : total === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nothing to pack yet</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add items above, or start from some ideas for a {TRIP_TYPE_LABELS[tripType].toLowerCase()} trip.</p>
          </div>
        ) : (
          <>
            {sharedItems.length > 0 && (
              <>
                <h3 className={heading}>On everyone’s list</h3>
                <ul>{sharedItems.map(row)}</ul>
              </>
            )}
            {mineItems.length > 0 && (
              <>
                <h3 className={heading}>Just mine</h3>
                <ul>{mineItems.map(row)}</ul>
              </>
            )}
          </>
        )}
        {items !== null && (
          <button
            onClick={addIdeas}
            disabled={isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-600/40 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-600/10 disabled:opacity-50 dark:text-blue-400"
          >
            <Sparkles size={13} />
            Add ideas for a {TRIP_TYPE_LABELS[tripType].toLowerCase()} trip
          </button>
        )}
        {error && <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </aside>
  );
}
