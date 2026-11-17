'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { deleteTrip } from '@/app/trips/actions';

export default function TripCard({
  id,
  name,
  cities,
  dateRange,
  status,
  isOwner,
  ownerLabel,
}: {
  id: string;
  name: string;
  cities: string;
  dateRange: string;
  status: { label: string; tone: 'live' | 'soon' | 'past' };
  isOwner: boolean;
  ownerLabel?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const result = await deleteTrip(id);
      if ('error' in result) setError(result.error);
      else router.refresh();
    });
  };

  const toneClass =
    status.tone === 'live'
      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
      : status.tone === 'soon'
        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';

  return (
    <div className={['group relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow', isPending ? 'opacity-50' : ''].join(' ')}>
      <Link href={`/trips/${id}`} className={['block p-5', isOwner ? 'pr-20' : ''].join(' ')}>
        <span className={['inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide mb-2', toneClass].join(' ')}>
          {status.label}
        </span>
        <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug truncate">{name}</h2>
        <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 min-w-0">
          <MapPin size={13} className="shrink-0" />
          <span className="truncate">{cities}</span>
        </p>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{dateRange}</p>
        {!isOwner && <p className="mt-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">Shared with you{ownerLabel ? ` by ${ownerLabel}` : ''}</p>}
      </Link>

      {isOwner && <div className="absolute top-3 right-3 flex items-center gap-0.5">
        <Link
          href={`/trips/${id}/edit`}
          title="Edit trip"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Pencil size={15} />
        </Link>
        <button
          onClick={() => setConfirming(true)}
          title="Delete trip"
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>}

      {error && <p className="px-5 pb-3 text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}

      {confirming && (
        <ConfirmDialog
          message={`Delete “${name}”? This permanently removes the trip along with all of its events, hotels and notes.`}
          confirmLabel="Delete trip"
          cancelLabel="Keep it"
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
