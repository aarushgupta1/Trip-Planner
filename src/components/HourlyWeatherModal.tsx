'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getDayHourly } from '@/app/trips/extras';
import { HourlyPoint, HourlyWeather, weatherCodeInfo, weatherKindLabel } from '@/lib/weather';
import { formatDateFull } from '@/lib/utils';
import { formatHour } from '@/lib/timeUtils';
import { useTrip } from './TripProvider';

type State = { status: 'loading' } | { status: 'done'; data: HourlyWeather[] } | { status: 'error' };

function rainText(p: HourlyPoint): string {
  if (!p.rain) return '';
  if (p.rain.kind === 'chance') return p.rain.value > 0 ? `${p.rain.value}%` : '—';
  return p.rain.value >= 0.005 ? `${p.rain.value.toFixed(2)} in` : '—';
}

// Every hour of one day, per city, in the city's own local time. Loaded when
// opened, so days nobody looks at cost nothing.
export default function HourlyWeatherModal({ date, onClose }: { date: string; onClose: () => void }) {
  const { trip } = useTrip();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    getDayHourly(trip.id, date)
      .then((data) => {
        if (live) setState({ status: 'done', data });
      })
      .catch(() => {
        if (live) setState({ status: 'error' });
      });
    return () => {
      live = false;
    };
  }, [trip.id, date]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border-t-2 border-t-blue-600 shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Hourly weather</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateFull(date)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-3">
          {state.status === 'loading' && <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</p>}
          {state.status === 'error' && (
            <p className="py-6 text-center text-sm text-red-500 dark:text-red-400">Couldn’t load the hourly weather. Try again in a moment.</p>
          )}
          {state.status === 'done' && state.data.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">No hourly weather is available for this day yet.</p>
          )}
          {state.status === 'done' &&
            state.data.map((w) => (
              <section key={w.city} className="mb-4 last:mb-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200">{w.cityName}</h3>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 text-right">{weatherKindLabel(w.kind)}</span>
                </div>
                <div className="grid grid-cols-[3.5rem_1.5rem_3rem_1fr] items-center gap-x-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pb-1 border-b border-gray-100 dark:border-gray-800">
                  <span>Time</span>
                  <span />
                  <span>Temp</span>
                  <span className="text-right">{w.hours[0]?.rain?.kind === 'chance' ? 'Rain chance' : 'Rainfall'}</span>
                </div>
                <ul>
                  {w.hours.map((h) => {
                    const { icon, label } = weatherCodeInfo(h.code);
                    return (
                      <li
                        key={h.hour}
                        className="grid grid-cols-[3.5rem_1.5rem_3rem_1fr] items-center gap-x-2 py-1 text-xs border-b border-gray-50 dark:border-gray-800/60 last:border-0"
                      >
                        <span className="font-mono text-gray-500 dark:text-gray-400">{formatHour(h.hour)}</span>
                        <span title={label} aria-label={label}>{icon}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">{h.temp}°</span>
                        <span className="text-right text-gray-500 dark:text-gray-400">{rainText(h)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
