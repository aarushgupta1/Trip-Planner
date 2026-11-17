'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AlertTriangle, CalendarPlus, Info, Send, Sparkles, X } from 'lucide-react';
import { askGuide } from '@/app/guide/actions';
import { Attraction, Hotel } from '@/lib/types';
import { GuideMessage, GuideSuggestion } from '@/lib/guide';
import { checkItinerary } from '@/lib/itineraryCheck';
import { CATEGORY_LABELS, formatDateFull, formatTime } from '@/lib/utils';
import { useTrip } from './TripProvider';

interface ChatTurn extends GuideMessage {
  suggestions?: GuideSuggestion[];
  checked?: string[]; // places whose hours etc. were looked up live
  failed?: boolean;
}

export default function GuidePanel({
  tripId,
  chatEnabled,
  attractions,
  hotels,
  onAddSuggestion,
  onJumpToDate,
  onClose,
}: {
  tripId: string;
  chatEnabled: boolean;
  attractions: Attraction[];
  hotels: Hotel[];
  onAddSuggestion: (s: GuideSuggestion) => void;
  onJumpToDate: (date: string) => void;
  onClose: () => void;
}) {
  const { dates } = useTrip();
  const [tab, setTab] = useState<'ask' | 'check'>('ask');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Free, instant, no AI — recomputed live as the calendar changes.
  const issues = useMemo(() => checkItinerary({ dates, attractions, hotels }), [dates, attractions, hotels]);
  const warnCount = issues.filter((i) => i.severity === 'warn').length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, isPending]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || isPending) return;
    const next: ChatTurn[] = [...turns.filter((t) => !t.failed), { role: 'user', content }];
    setTurns(next);
    setInput('');
    setTab('ask');
    startTransition(async () => {
      const result = await askGuide(tripId, next.map(({ role, content: c }) => ({ role, content: c })));
      setTurns((prev) =>
        'error' in result
          ? [...prev, { role: 'assistant', content: result.error, failed: true }]
          : [...prev, { role: 'assistant', content: result.reply, suggestions: result.suggestions, checked: result.checked }]
      );
    });
  };

  const firstEmptyDay = dates.find((d) => !attractions.some((a) => a.scheduled_date === d));
  const starters = [
    firstEmptyDay ? `What should we do on ${formatDateFull(firstEmptyDay)}?` : 'What should we add to this trip?',
    'Is my plan too packed anywhere?',
    'Backup ideas in case it rains',
    'Where should we eat near our hotel?',
  ];

  const fixPrompt =
    'Please look at these problems with my itinerary and suggest how to fix them:\n' +
    issues
      .filter((i) => i.severity === 'warn')
      .slice(0, 8)
      .map((i) => `- ${i.message}`)
      .join('\n');

  return (
    <aside
      className="fixed right-0 top-14 bottom-0 z-40 flex w-full flex-col border-l border-t-2 border-gray-200 border-t-blue-600 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:w-[400px]"
      aria-label="Aero"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Sparkles size={14} />
          </span>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Aero</h2>
        </div>
        <button onClick={onClose} aria-label="Close Aero" className="rounded-lg p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-100 px-3 pt-2 dark:border-gray-800">
        {(['ask', 'check'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              '-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors',
              tab === t
                ? 'border-blue-600 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {t === 'ask' ? 'Ask' : 'Itinerary check'}
            {t === 'check' && warnCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                {warnCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'ask' ? (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <div>
                <p className="font-serif text-lg leading-snug text-gray-900 dark:text-gray-100">
                  Ask Aero anything about this trip.
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  I can see your days, hotels and weather, so my ideas fit what you’ve already planned. Double-check opening hours before you go.
                </p>
                {!chatEnabled && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Aero’s chat isn’t switched on for this app yet. The itinerary check still works.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      disabled={!chatEnabled}
                      onClick={() => send(s)}
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-left text-xs text-gray-600 transition-colors hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'flex justify-end' : ''}>
                <div
                  className={[
                    'max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    t.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : t.failed
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
                  ].join(' ')}
                >
                  {t.content}
                </div>
                {t.checked && t.checked.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    Checked live on Google Maps: {t.checked.join(', ')}
                  </p>
                )}
                {t.suggestions && t.suggestions.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {t.suggestions.map((s, j) => (
                      <li key={j} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{s.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDateFull(s.date)}
                              {s.start_time ? ` · ${formatTime(s.start_time)}` : ''} · {CATEGORY_LABELS[s.category]}
                            </p>
                          </div>
                          <button
                            onClick={() => onAddSuggestion(s)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                          >
                            <CalendarPlus size={13} />
                            Add
                          </button>
                        </div>
                        {s.description && <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">{s.description}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {isPending && (
              <div className="inline-flex gap-1 rounded-2xl bg-gray-100 px-3.5 py-3 dark:bg-gray-800" aria-label="Aero is thinking">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d * 120}ms` }} />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-gray-100 p-3 dark:border-gray-800"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              maxLength={2000}
              disabled={!chatEnabled}
              placeholder={chatEnabled ? 'Ask about a day, a place, a plan…' : 'Chat is off'}
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={!chatEnabled || isPending || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {issues.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing to flag. Your plan looks solid.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {issues.map((issue, i) => (
                  <li key={i}>
                    <button
                      onClick={() => issue.date && onJumpToDate(issue.date)}
                      className="flex w-full items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      {issue.severity === 'warn' ? (
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                      ) : (
                        <Info size={15} className="mt-0.5 shrink-0 text-gray-400" />
                      )}
                      <span className="min-w-0 text-sm text-gray-700 dark:text-gray-200">
                        {issue.date && <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{formatDateFull(issue.date)}</span>}
                        {issue.message}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {chatEnabled && warnCount > 0 && (
                <button
                  onClick={() => send(fixPrompt)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Sparkles size={14} />
                  Ask Aero how to fix these
                </button>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
