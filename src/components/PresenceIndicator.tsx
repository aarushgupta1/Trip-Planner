'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Users } from 'lucide-react';

interface PresenceEntry {
  user_id: string;
  name: string;
}

interface Person {
  userId: string;
  name: string;
}

// Shows who is looking at this trip right now, using Supabase Realtime
// Presence: every open tab tracks itself on a per-trip channel with the
// signed-in account's id and name, and everyone sees the list update live.
// Several tabs/devices of the same account count once (deduped by account id),
// and each person is labelled with their account name — not a typed-in label.
export default function PresenceIndicator({ tripId, userId, name }: { tripId: string; userId: string; name: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client.channel(`presence-${tripId}`, { config: { presence: { key: userId } } });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceEntry>();
      const byUser = new Map<string, Person>();
      for (const entries of Object.values(state)) {
        for (const e of entries) {
          if (e.user_id && !byUser.has(e.user_id)) byUser.set(e.user_id, { userId: e.user_id, name: e.name });
        }
      }
      setPeople([...byUser.values()]);
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ user_id: userId, name, online_at: new Date().toISOString() });
    });

    return () => {
      client.removeChannel(channel);
    };
  }, [tripId, userId, name]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Nothing until this tab's own presence has synced at least once.
  if (people.length === 0) return null;

  const others = people.filter((p) => p.userId !== userId);
  const isAlone = others.length === 0;
  // You first, then everyone else alphabetically.
  const sorted = [...people].sort((a, b) => (a.userId === userId ? -1 : b.userId === userId ? 1 : a.name.localeCompare(b.name)));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={isAlone ? "You're the only one here right now" : `${people.length} here now: ${sorted.map((p) => p.name).join(', ')}`}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <Users size={12} />
        {people.length}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[150px] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5 px-1">
          {isAlone && <p className="px-2.5 py-1 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">Just you right now</p>}
          {!isAlone &&
            sorted.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {p.name}
                {p.userId === userId && <span className="text-gray-400">(you)</span>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
