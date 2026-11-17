'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plane, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { deleteTrip } from '@/app/trips/actions';
import { barcodeBars, cityCode, ticketAccent, ticketNumber } from '@/lib/ticket';

const MAX_STOPS_SHOWN = 4;

function parts(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  return {
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    day: d.getUTCDate(),
    year: d.getUTCFullYear(),
  };
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className="ticket-serif text-[15px] leading-tight truncate">{value}</div>
    </div>
  );
}

export default function TripCard({
  id,
  name,
  stops,
  start,
  end,
  days,
  status,
  isOwner,
}: {
  id: string;
  name: string;
  stops: { name: string; country: string }[];
  start: string;
  end: string;
  days: number;
  status: { label: string; tone: 'live' | 'soon' | 'past' };
  isOwner: boolean;
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

  const accent = ticketAccent(id);
  const s = parts(start);
  const e = parts(end);
  const range = (p: typeof s) => `${p.month} ${p.day}`;
  const shown = stops.length > MAX_STOPS_SHOWN ? stops.slice(0, MAX_STOPS_SHOWN - 1).concat(stops[stops.length - 1]) : stops;
  const hidden = stops.length - shown.length;
  const past = status.tone === 'past';
  const bars = barcodeBars(id);
  const barXs = bars.map((_, i) => bars.slice(0, i).reduce((n, w) => n + w + 1, 0));
  const barWidth = bars.reduce((n, w) => n + w + 1, 0);

  return (
    <div
      className={['ticket', isPending ? 'opacity-50 pointer-events-none' : ''].join(' ')}
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <div className="ticket-paper">
        {/* Whole ticket opens the trip; the edit/delete buttons sit above this. */}
        <Link href={`/trips/${id}`} aria-label={`Open ${name}`} className="absolute inset-0 z-0 rounded-[14px] outline-none" />

        {/* ---- main body ---- */}
        <div className="relative pointer-events-none px-5 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Trip No. {ticketNumber(id)}</div>
              <h2 className="ticket-serif mt-0.5 text-lg sm:text-xl leading-snug truncate" title={name}>{name}</h2>
            </div>
            <span
              className="shrink-0 mt-0.5 rounded-md border-2 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.14em] whitespace-nowrap"
              style={{
                borderColor: past ? 'var(--rule)' : 'var(--accent)',
                color: past ? 'var(--muted)' : 'var(--accent)',
                transform: 'rotate(-4deg)',
                opacity: past ? 0.9 : 1,
              }}
            >
              {past ? 'Been there' : status.tone === 'live' ? 'Underway' : status.label}
            </span>
          </div>

          {/* route, boarding-pass style */}
          <div className="mt-4 flex items-start">
            {shown.map((stop, i) => (
              <div key={`${stop.name}-${i}`} className="contents">
                {i > 0 && (
                  <div className="mx-2 mt-[17px] flex min-w-4 flex-1 items-center text-[var(--muted)]" aria-hidden>
                    <span className="h-px flex-1 border-t border-dashed border-current" />
                    {(i === shown.length - 1 && hidden === 0) || i === 1 ? <Plane size={12} className="mx-1 shrink-0 rotate-90" /> : null}
                    <span className="h-px flex-1 border-t border-dashed border-current" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="ticket-serif text-[28px] sm:text-[34px] leading-none tracking-tight">{cityCode(stop.name)}</div>
                  <div className="mt-1 max-w-[7.5rem] truncate text-[11px] text-[var(--muted)]">{stop.name}</div>
                </div>
                {hidden > 0 && i === shown.length - 2 && (
                  <div className="mx-2 mt-[17px] flex flex-1 items-center text-[var(--muted)]" aria-hidden>
                    <span className="h-px flex-1 border-t border-dashed border-current" />
                    <span className="mx-1 text-[10px] font-semibold">+{hidden}</span>
                    <span className="h-px flex-1 border-t border-dashed border-current" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-dashed border-[var(--rule)] pt-3">
            <Field label="Depart" value={range(s)} />
            <Field label="Return" value={range(e)} />
            <Field label="Days" value={String(days)} />
          </div>

          {!isOwner && <p className="mt-2 text-[11px] italic text-[var(--muted)]">Shared with you</p>}
          {error && <p className="mt-2 text-xs font-medium text-red-500 dark:text-red-400">{error}</p>}
        </div>

        {/* ---- tear-off stub ---- */}
        <div className="ticket-stub pointer-events-none flex items-center justify-between gap-3 px-5 py-3 sm:flex-col sm:justify-center sm:gap-2 sm:px-3 sm:py-4">
          <div className="text-left sm:text-center">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{s.month}</div>
            <div className="ticket-serif text-4xl sm:text-5xl leading-none">{s.day}</div>
            <div className="mt-0.5 text-[10px] text-[var(--muted)]">{s.year}</div>
          </div>

          <svg
            viewBox={`0 0 ${barWidth} 24`}
            className="h-6 w-24 shrink-0 text-[var(--ink)] opacity-70"
            preserveAspectRatio="none"
            aria-hidden
          >
            {barXs.map((x, i) => (
              <rect key={i} x={x} y={0} width={bars[i]} height={24} fill="currentColor" />
            ))}
          </svg>

          {isOwner && (
            <div className="pointer-events-auto relative z-10 flex items-center gap-0.5 sm:absolute sm:bottom-1.5 sm:right-1.5">
              <Link
                href={`/trips/${id}/edit`}
                title="Edit trip"
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <Pencil size={14} />
              </Link>
              <button
                onClick={() => setConfirming(true)}
                title="Delete trip"
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

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
