'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import TripForm from './TripForm';
import CitySearch from './CitySearch';
import { setMyOrigin } from '@/app/trips/actions';
import type { TripInput } from '@/lib/tripInput';
import { deleteTrip } from '@/app/trips/actions';
import { TripType, TRIP_TYPE_LABELS } from '@/lib/utils';
import type { TripPlace } from '@/lib/trip';
import { barcodeBars, cityCode, formatPassengers } from '@/lib/ticket';

const MAX_STOPS_SHOWN = 3; // destinations shown between the start and end

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
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="text-sm font-medium leading-tight truncate">{value}</div>
    </div>
  );
}

function HomeEditor({
  tripId,
  home,
  homeEnd,
  myStart,
  myEnd,
}: {
  tripId: string;
  home: string;
  homeEnd: string;
  myStart: TripPlace | null;
  myEnd: TripPlace | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dStart, setDStart] = useState<TripPlace | null>(myStart);
  const [dEnd, setDEnd] = useState<TripPlace | null>(myEnd); // null = same as start
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openEditor = () => {
    setDStart(myStart);
    setDEnd(myEnd);
    setPicking(null);
    setError(null);
    setOpen(true);
  };

  const save = (start: TripPlace | null, end: TripPlace | null) => {
    setError(null);
    startTransition(async () => {
      const result = await setMyOrigin(tripId, start, end);
      if ('error' in result) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  const link = 'hover:text-[var(--accent)] underline-offset-2 hover:underline';
  const different = homeEnd !== home;

  return (
    <div className="pointer-events-auto relative z-10 mt-2 text-[11px] text-[var(--muted)]">
      {!open ? (
        <button
          type="button"
          onClick={openEditor}
          title="Change where you start and end this trip (only changes it for you)"
          className="inline-flex items-center gap-1 hover:text-[var(--accent)]"
        >
          <Pencil size={11} />
          {different ? `Starting in ${home || 'your city'} · Ending in ${homeEnd}` : `Starting & ending in ${home || 'your city'}`}
        </button>
      ) : (
        <div className={['max-w-xs space-y-2', pending ? 'opacity-60 pointer-events-none' : ''].join(' ')}>
          <div>
            <div className="mb-0.5">Starting from</div>
            {picking === 'start' ? (
              <CitySearch autoFocus onSelect={(c) => { setDStart(c); setPicking(null); }} placeholder="Search for a city…" />
            ) : (
              <div className="flex items-center gap-2 text-[var(--ink)]">
                <span className="font-medium">{dStart ? dStart.name : `${home || 'Trip default'} (trip default)`}</span>
                <button type="button" onClick={() => setPicking('start')} className={`text-[var(--muted)] ${link}`}>Change</button>
              </div>
            )}
          </div>

          {dStart ? (
            <div>
              <div className="mb-0.5">Ending in</div>
              {picking === 'end' ? (
                <CitySearch autoFocus onSelect={(c) => { setDEnd(c); setPicking(null); }} placeholder="Search for a city…" />
              ) : (
                <div className="flex items-center gap-2 text-[var(--ink)]">
                  <span className="font-medium">{dEnd ? dEnd.name : `${dStart.name} (same as start)`}</span>
                  <button type="button" onClick={() => setPicking('end')} className={`text-[var(--muted)] ${link}`}>Change</button>
                  {dEnd && <button type="button" onClick={() => setDEnd(null)} className={`text-[var(--muted)] ${link}`}>Same as start</button>}
                </div>
              )}
            </div>
          ) : (
            <p>Pick your own starting city to choose a different end.</p>
          )}

          <div className="flex items-center gap-3 pt-0.5">
            <button
              type="button"
              onClick={() => save(dStart, dStart ? dEnd : null)}
              className="rounded-[3px] bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              Save
            </button>
            {(myStart || myEnd) && (
              <button type="button" onClick={() => save(null, null)} className={link}>Use the trip default</button>
            )}
            <button type="button" onClick={() => setOpen(false)} className={link}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-red-600 dark:text-red-400">{error}</p>}
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
  passengers,
  number,
  tripType,
  home,
  homeEnd,
  myStart,
  myEnd,
  initial,
  startEditing = false,
}: {
  id: string;
  name: string;
  stops: { name: string; country: string }[];
  start: string;
  end: string;
  days: number;
  status: { label: string; tone: 'live' | 'soon' | 'past' };
  isOwner: boolean;
  passengers: string[]; // everyone on the trip, owner first
  tripType: TripType;
  home: string; // where this person starts the trip
  homeEnd: string; // where this person ends it (often the same place)
  myStart: TripPlace | null; // their own picks (null = the trip default)
  myEnd: TripPlace | null; // null = ends where they started
  initial: TripInput; // current settings, for editing in place
  startEditing?: boolean;
  number: number; // 1 for your first trip, 2 for the next, and so on
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing);
  const editRef = useRef<HTMLDivElement>(null);
  // Arriving from a trip's "Trip settings" button: bring this ticket into view.
  useEffect(() => {
    if (startEditing) editRef.current?.scrollIntoView({ block: 'start' });
  }, [startEditing]);
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

  const s = parts(start);
  const e = parts(end);
  const range = (p: typeof s) => `${p.month} ${p.day}`;
  const middle = stops.length > MAX_STOPS_SHOWN ? stops.slice(0, MAX_STOPS_SHOWN - 1).concat(stops[stops.length - 1]) : stops;
  const hidden = stops.length - middle.length;
  const homeStop = home ? { name: home, country: '' } : null;
  const endStop = homeEnd ? { name: homeEnd, country: '' } : homeStop;
  const shown = homeStop && endStop ? [homeStop, ...middle, endStop] : middle;
  const past = status.tone === 'past';
  const pax = formatPassengers(passengers);
  const bars = barcodeBars(id);
  const barXs = bars.map((_, i) => bars.slice(0, i).reduce((n, w) => n + w + 1, 0));
  const barWidth = bars.reduce((n, w) => n + w + 1, 0);
  // Red marks what's coming up; finished trips go quiet, and a trip that's
  // underway takes the blue.
  const statusColor = past ? 'var(--muted)' : status.tone === 'live' ? 'var(--accent)' : 'var(--red)';

  if (editing) {
    return (
      <div ref={editRef} className={['ticket ticket-editing scroll-mt-20', `ticket-${tripType}`].join(' ')}>
        <div className="ticket-paper ticket-paper-editing px-5 py-5 sm:px-6">
          <div className="mb-4 font-mono text-[11px] tracking-[0.08em] text-[var(--accent)]">TRIP {number} · EDIT SETTINGS</div>
          <TripForm mode="edit" tripId={id} initial={initial} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className={['ticket', `ticket-${tripType}`, confirming ? 'ticket-locked' : '', isPending ? 'opacity-50 pointer-events-none' : ''].join(' ')}>
      <div className="ticket-paper">
        {/* Whole ticket opens the trip; the edit/delete buttons sit above this. */}
        <Link href={`/trips/${id}`} aria-label={`Open ${name}`} className="absolute inset-0 z-0 rounded-[6px] outline-none" />

        {/* ---- main body ---- */}
        <div className="relative pointer-events-none px-5 pt-4 pb-4 sm:px-6 sm:pt-4 sm:pb-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[11px] tracking-[0.08em] text-[var(--accent)]">TRIP {number} · {TRIP_TYPE_LABELS[tripType].toUpperCase()}</div>
              <h2 className="mt-0.5 text-base sm:text-[17px] font-semibold leading-snug tracking-tight truncate" title={name}>{name}</h2>
            </div>
            <span
              className="shrink-0 mt-1 -rotate-6 rounded-[3px] border-2 px-2 py-[1px] font-mono text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap opacity-90"
              style={{ borderColor: statusColor, color: statusColor }}
            >
              {past ? 'Completed' : status.tone === 'live' ? 'Underway' : status.label}
            </span>
          </div>

          {/* route */}
          <div className="mt-4 flex items-start">
            {shown.map((stop, i) => (
              <div key={`${stop.name}-${i}`} className="contents">
                {i > 0 && (
                  <div className="mx-3 mt-[10px] flex min-w-4 flex-1 flex-col" aria-hidden>
                    <div className="ticket-route" />
                    {hidden > 0 && i === middle.length - (homeStop ? 0 : 1) && (
                      <span className="mt-1 text-center text-[10px] text-[var(--muted)]">+{hidden} more</span>
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-mono text-2xl sm:text-[26px] font-medium leading-none tracking-[0.02em] text-[var(--accent)]">{cityCode(stop.name)}</div>
                  <div className="mt-1 max-w-[7.5rem] truncate text-[11px] text-[var(--muted)]">{stop.name}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Each person picks their own start/end cities; others never see this. */}
          <HomeEditor tripId={id} home={home} homeEnd={homeEnd} myStart={myStart} myEnd={myEnd} />

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--rule)] pt-2.5">
            <Field label="Depart" value={range(s)} />
            <Field label="Return" value={range(e)} />
            <Field label="Days" value={String(days)} />
          </div>

          {pax.shown.length > 0 && (
            <div className="mt-2.5 border-t border-[var(--rule)] pt-2.5 min-w-0">
              <div className="font-mono text-[11px] tracking-[0.08em] text-[var(--accent)]">
                {passengers.length === 1 ? 'PASSENGER' : `PASSENGERS · ${passengers.length}`}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5" title={passengers.join(', ')}>
                {pax.shown.map((n, i) => (
                  <span key={`${n}-${i}`} className="max-w-[12rem] truncate pt-0.5 font-hand text-[22px] leading-[1.1]">
                    {n}
                  </span>
                ))}
                {pax.more > 0 && <span className="self-center text-xs text-[var(--muted)]">+{pax.more} more</span>}
              </div>
            </div>
          )}

          {!isOwner && <p className="mt-2 text-[11px] text-[var(--muted)]">Shared with you</p>}
          {error && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* ---- tear-off stub ---- */}
        <div className="ticket-stub pointer-events-none flex items-center justify-between gap-3 px-5 py-3 sm:flex-col sm:justify-center sm:gap-2 sm:px-3 sm:py-4">
          <div className="text-left sm:text-center">
            <div className="font-mono text-[11px] tracking-[0.1em] text-[var(--accent)]">{s.month.toUpperCase()}</div>
            <div className="text-4xl sm:text-[38px] font-semibold leading-none tracking-tight text-[var(--accent)]">{s.day}</div>
            <div className="mt-0.5 text-[10px] text-[var(--muted)]">{s.year}</div>
          </div>

          <svg
            viewBox={`0 0 ${barWidth} 24`}
            className="h-5 w-20 shrink-0 text-[var(--ink)] opacity-60"
            preserveAspectRatio="none"
            aria-hidden
          >
            {barXs.map((x, i) => (
              <rect key={i} x={x} y={0} width={bars[i]} height={24} fill="currentColor" />
            ))}
          </svg>

          {isOwner && (
            <div className="pointer-events-auto relative z-10 flex items-center gap-0.5 sm:absolute sm:bottom-1 sm:right-1">
              <button
                onClick={() => setEditing(true)}
                title="Edit trip: name, type, dates and cities"
                className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                onClick={() => setConfirming(true)}
                title="Delete trip"
                className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--red)] hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          message={`Delete “${name}”? This permanently removes the trip along with all of its events, lodgings and notes.`}
          confirmLabel="Delete trip"
          cancelLabel="Keep it"
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
