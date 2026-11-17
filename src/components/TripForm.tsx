'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Plus, CalendarRange, Globe2, AlertTriangle } from 'lucide-react';
import CitySearch from './CitySearch';
import { createTrip, updateTrip, CitySuggestion } from '@/app/trips/actions';
import { CityInput, TripInput, validateTripInput, MAX_CITIES } from '@/lib/tripInput';
import { datesInRange, formatDateShort } from '@/lib/utils';

const inputClass =
  'w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300 dark:placeholder-gray-600';
const labelClass = 'block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

interface StopDraft extends CityInput {
  key: string;
}

// Splits the trip's days into consecutive blocks, one per stop, as evenly
// as possible (earlier stops get the extra day). If there are more stops
// than days, the last ones share the final day.
function splitEvenly(start: string, end: string, count: number): { start: string; end: string }[] {
  const days = datesInRange(start, end);
  if (days.length === 0) return Array.from({ length: count }, () => ({ start, end }));
  const base = Math.floor(days.length / count);
  const extra = days.length % count;
  const out: { start: string; end: string }[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < extra ? 1 : 0);
    if (size === 0) {
      out.push({ start: days[days.length - 1], end: days[days.length - 1] });
      continue;
    }
    out.push({ start: days[cursor], end: days[cursor + size - 1] });
    cursor += size;
  }
  return out;
}

let keyCounter = 0;
const newKey = () => `stop-${++keyCounter}`;

export default function TripForm({
  mode,
  tripId,
  initial,
}: {
  mode: 'create' | 'edit';
  tripId?: string;
  initial?: TripInput;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  // '' = "use this device's time zone", resolved when saving (so the server
  // render and the browser never disagree about it).
  const [homeTimezone, setHomeTimezone] = useState(initial?.home_timezone ?? '');
  const [stops, setStops] = useState<StopDraft[]>(() => (initial?.cities ?? []).map((c) => ({ ...c, key: newKey() })));
  // Once someone edits a stop's dates by hand we stop auto-spreading days
  // across stops (it would overwrite their work).
  const [datesEdited, setDatesEdited] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const timeZones = useMemo(() => {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    return fn ? fn('timeZone') : ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
  }, []);

  const tripDays = startDate && endDate && endDate >= startDate ? datesInRange(startDate, endDate).length : 0;
  const hasRange = tripDays > 0;

  const applyDefaults = (next: StopDraft[], start: string, end: string): StopDraft[] => {
    if (!start || !end || end < start || next.length === 0) return next;
    const blocks = splitEvenly(start, end, next.length);
    return next.map((s, i) => ({ ...s, start_date: blocks[i].start, end_date: blocks[i].end }));
  };

  const clampStops = (next: StopDraft[], start: string, end: string): StopDraft[] =>
    next.map((s) => {
      const s0 = s.start_date < start ? start : s.start_date > end ? end : s.start_date;
      const e0 = s.end_date > end ? end : s.end_date < start ? start : s.end_date;
      return { ...s, start_date: s0, end_date: e0 < s0 ? s0 : e0 };
    });

  const handleTripDates = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (!start || !end || end < start) return;
    setStops((prev) => (datesEdited ? clampStops(prev, start, end) : applyDefaults(prev, start, end)));
  };

  const addCity = (c: CitySuggestion) => {
    setError(null);
    const draft: StopDraft = {
      key: newKey(),
      name: c.name,
      country: c.country,
      country_code: c.country_code,
      lat: c.lat,
      lng: c.lng,
      timezone: c.timezone,
      start_date: startDate,
      end_date: endDate,
    };
    setStops((prev) => {
      const next = [...prev, draft];
      return datesEdited || !hasRange ? next : applyDefaults(next, startDate, endDate);
    });
  };

  const removeCity = (key: string) => {
    setStops((prev) => {
      const next = prev.filter((s) => s.key !== key);
      return datesEdited || !hasRange ? next : applyDefaults(next, startDate, endDate);
    });
  };

  const updateStopDate = (key: string, field: 'start_date' | 'end_date', value: string) => {
    setDatesEdited(true);
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  };

  const resolveHomeTimezone = () => homeTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: TripInput = {
      name,
      start_date: startDate,
      end_date: endDate,
      home_timezone: resolveHomeTimezone(),
      cities: stops.map(({ key: _key, ...rest }) => { void _key; return rest; }),
    };
    const problem = validateTripInput(input);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = mode === 'create' ? await createTrip(input) : await updateTrip(tripId!, input);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const id = mode === 'create' ? (result as { id: string }).id : tripId!;
      router.push(`/trips/${id}`);
      router.refresh();
    });
  };

  const backHref = mode === 'edit' && tripId ? `/trips/${tripId}` : '/';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label htmlFor="trip-name" className={labelClass}>Trip name</label>
        <input
          id="trip-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className={inputClass}
          placeholder="e.g. Summer in Italy"
          autoFocus={mode === 'create'}
        />
      </div>

      {/* Dates */}
      <div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="trip-start" className={labelClass}>
              <CalendarRange size={11} className="inline -mt-0.5 mr-1" />
              Start date
            </label>
            <input
              id="trip-start"
              type="date"
              value={startDate}
              onChange={(e) => handleTripDates(e.target.value, endDate && endDate < e.target.value ? e.target.value : endDate)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="trip-end" className={labelClass}>End date</label>
            <input
              id="trip-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleTripDates(startDate, e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        {hasRange && (
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            {tripDays} day{tripDays === 1 ? '' : 's'} · {formatDateShort(startDate)} – {formatDateShort(endDate)}
          </p>
        )}
      </div>

      {/* Destinations */}
      <div>
        <label className={labelClass}>
          <Globe2 size={11} className="inline -mt-0.5 mr-1" />
          Where are you going?
        </label>

        {stops.length > 0 && (
          <ul className="space-y-2 mb-3">
            {stops.map((s) => (
              <li
                key={s.key}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {s.country || 'Unknown country'} · {s.timezone}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCity(s.key)}
                    title="Remove"
                    className="shrink-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
                {stops.length > 1 && hasRange && (
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">From</label>
                      <input
                        type="date"
                        value={s.start_date}
                        min={startDate}
                        max={endDate}
                        onChange={(e) => updateStopDate(s.key, 'start_date', e.target.value)}
                        className={inputClass + ' !py-1.5'}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">To</label>
                      <input
                        type="date"
                        value={s.end_date}
                        min={s.start_date || startDate}
                        max={endDate}
                        onChange={(e) => updateStopDate(s.key, 'end_date', e.target.value)}
                        className={inputClass + ' !py-1.5'}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {stops.length < MAX_CITIES && (
          <CitySearch
            onSelect={addCity}
            placeholder={stops.length === 0 ? 'Search for a city, e.g. Rome' : 'Add another stop…'}
          />
        )}
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {stops.length > 1
            ? 'Set the days you’re in each place. Days can overlap — handy for a day trip from a base city.'
            : 'Visiting more than one place? Add each one and split up the days.'}
        </p>
      </div>

      {/* Home time zone */}
      <div>
        <label htmlFor="home-tz" className={labelClass}>Where are you travelling from?</label>
        <select
          id="home-tz"
          value={homeTimezone}
          onChange={(e) => setHomeTimezone(e.target.value)}
          suppressHydrationWarning
          className={inputClass}
        >
          <option value="">This device’s time zone</option>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          Lets flights show departure and arrival times in your home time as well as local time.
        </p>
      </div>

      {mode === 'edit' && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Changing the dates never deletes anything. Events, hotels and notes that fall outside the new dates are
            kept, just hidden until the dates include them again.
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}

      <div className="flex gap-3">
        <Link
          href={backHref}
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {mode === 'create' && <Plus size={15} />}
          {isPending ? 'Saving…' : mode === 'create' ? 'Create trip' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
