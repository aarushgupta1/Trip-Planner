'use client';

import { Eye, Lock, Users } from 'lucide-react';
import type { TripPerson } from '@/app/trips/actions';
import { audienceLabel } from '@/lib/visibility';

type Mode = 'everyone' | 'only-me' | 'choose';

// "Who can see this" for an event. Only the person who added the event can
// change it; everyone else just sees who it's shared with.
export default function VisibilityPicker({
  people,
  currentUserId,
  value,
  onChange,
  canChange,
  disabled = false,
}: {
  people: TripPerson[];
  currentUserId: string;
  value: string[] | null; // null = everyone
  onChange: (next: string[] | null) => void;
  canChange: boolean;
  disabled?: boolean;
}) {
  // Nothing to choose when you're the only one on the trip.
  if (people.length < 2) return null;

  const others = people.filter((p) => p.user_id !== currentUserId);
  const selectedOthers = value ? value.filter((id) => id !== currentUserId) : [];
  const mode: Mode = !value ? 'everyone' : selectedOthers.length === 0 ? 'only-me' : 'choose';

  const label = 'block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

  if (!canChange) {
    return (
      <div>
        <span className={label}>Who can see this</span>
        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          {value ? <Lock size={12} /> : <Eye size={12} />}
          {audienceLabel(value, people, currentUserId)}
        </p>
      </div>
    );
  }

  const options: { id: Mode; text: string; icon: React.ReactNode }[] = [
    { id: 'everyone', text: 'Everyone', icon: <Users size={13} /> },
    { id: 'only-me', text: 'Only me', icon: <Lock size={13} /> },
    { id: 'choose', text: 'Choose people', icon: <Eye size={13} /> },
  ];

  const pick = (m: Mode) => {
    if (m === 'everyone') onChange(null);
    else if (m === 'only-me') onChange([currentUserId]);
    else onChange([currentUserId, ...(selectedOthers.length ? selectedOthers : others.slice(0, 1).map((p) => p.user_id))]);
  };

  const toggle = (id: string) => {
    const next = selectedOthers.includes(id) ? selectedOthers.filter((x) => x !== id) : [...selectedOthers, id];
    onChange([currentUserId, ...next]);
  };

  return (
    <div>
      <span className={label}>Who can see this</span>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Who can see this">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={mode === o.id}
            disabled={disabled}
            onClick={() => pick(o.id)}
            className={[
              'inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-60',
              mode === o.id
                ? 'border-blue-400 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
            ].join(' ')}
          >
            {o.icon}
            {o.text}
          </button>
        ))}
      </div>
      {mode === 'choose' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {others.map((p) => {
            const on = selectedOthers.includes(p.user_id);
            return (
              <button
                key={p.user_id}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => toggle(p.user_id)}
                className={[
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                  on
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                ].join(' ')}
              >
                {p.display_name}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        {mode === 'everyone' ? 'Everyone on the trip sees and can edit this.' : 'Hidden from everyone else. People you pick can see and edit it.'}
      </p>
    </div>
  );
}
