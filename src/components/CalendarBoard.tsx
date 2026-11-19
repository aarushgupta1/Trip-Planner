'use client';

import dynamic from 'next/dynamic';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { Attraction, DayNote, Hotel } from '@/lib/types';
import { formatDate, timeAgo, formatTimeInZone, getHotelDates } from '@/lib/utils';
import { getEditorName } from '@/lib/editorName';
import { cityKey } from '@/lib/trip';
import { useTrip } from './TripProvider';
import { canSeeAttraction } from '@/lib/visibility';
import type { TripPerson } from '@/app/trips/actions';
import { DayWeather, HourlyWeather, weatherCodeInfo, weatherKindLabel } from '@/lib/weather';
import { getDayHourly } from '@/app/trips/extras';
import { getWordOfDay } from '@/lib/wordOfDay';
import { TravelSegment, TravelMode } from '@/lib/travel';
import {
  DAYS_PER_PAGE,
  GRID_START_HOUR,
  GRID_END_HOUR,
  getDuration,
  getEventHeight,
  timeToMinutes,
  minutesToTime,
  DEFAULT_DURATION_MINUTES,
  findTimeConflict,
} from '@/lib/timeUtils';
import { getSupabaseClient } from '@/lib/supabase';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { getNowInZone } from '@/lib/tripTime';
import { useNowInZone } from '@/lib/tripClock';
import { usePushNotifications } from '@/lib/pushNotifications';
import { updateAttraction, upsertDayNote, restoreAttraction, restoreHotel } from '@/app/actions';
import DayColumn from './DayColumn';
import HotelsSidebar from './HotelsSidebar';
import HotelModal from './HotelModal';
import AttractionBlock from './AttractionBlock';
import EditModal from './EditModal';
import CreateModal from './CreateModal';
import GuidePanel from './GuidePanel';
import AeroPlaneIcon from './AeroPlaneIcon';
import PackingPanel from './PackingPanel';
import type { GuideSuggestion } from '@/lib/guide';
import NotificationsMenu from './NotificationsMenu';
import FlightPathIcon from './FlightPathIcon';
import ThemeToggle from './ThemeToggle';
import TimeLabels from './TimeLabels';
import { Pencil, PanelLeftOpen, WifiOff, CalendarDays, ArrowRight, Clock, Luggage, Map as MapIcon } from 'lucide-react';

// Leaflet touches `window`/`document` at import time, so it can only ever
// load on the client — ssr: false keeps it (and its CSS) out of the server
// render entirely instead of crashing it.
const MapView = dynamic(() => import('./MapView'), { ssr: false });

function pageForDate(dates: string[], date: string, daysPerPage: number): number {
  const idx = dates.indexOf(date);
  return idx === -1 ? 0 : Math.floor(idx / daysPerPage);
}


function hourlyKindShort(kind: DayWeather['kind']): string {
  return kind === 'forecast' ? 'Forecast' : kind === 'observed' ? 'Recorded' : 'Historical';
}

function DayHeader({
  date, note, onNoteChange, onNoteCommit, weather, hotels, onHotelClick, onOpenMap, onOpenHourly, hourlyActive, hourlyLoading, dimmed, readOnly, isToday, prevDate,
}: {
  date: string;
  // The day before this one on screen (undefined for the first visible day).
  prevDate?: string;
  note: string;
  onNoteChange: (v: string) => void;
  onNoteCommit: (v: string) => void;
  weather?: DayWeather[];
  hotels: Hotel[];
  onHotelClick: (hotel: Hotel) => void;
  onOpenMap: () => void;
  onOpenHourly: (city?: string) => void; // city = cityKey, when the day has several
  hourlyActive: boolean;
  hourlyLoading: boolean;
  dimmed: boolean; // another day's hourly weather is showing
  readOnly: boolean;
  isToday: boolean;
}) {
  const { weekday, monthDay } = formatDate(date);
  const [editing, setEditing] = useState(false);
  // On a day spent in more than one place, "Hourly weather" first asks which.
  const [choosingCity, setChoosingCity] = useState(false);
  const chooserRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!choosingCity) return;
    const close = (e: MouseEvent) => {
      if (chooserRef.current && !chooserRef.current.contains(e.target as Node)) setChoosingCity(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [choosingCity]);
  // A day-trip day (e.g. a day trip) belongs to more than one city — everything
  // below renders one badge/weather-line per city rather than assuming a
  // single one.
  const { trip, getCitiesForDate, cityColor } = useTrip();
  const cities = getCitiesForDate(date);
  // Only real forecasts and recorded weather are shown. A day too far out for
  // a forecast shows no temperature rather than a historical average.
  const shownWeather = weather?.filter((w) => w.kind !== 'typical');
  // A city's name is only spelled out where its stay begins (or on the first
  // day shown); later days of the same stay just carry its colour dot, so the
  // same place isn't repeated under every date.
  const previousKeys = prevDate ? getCitiesForDate(prevDate).map((c) => cityKey(c)) : [];
  const wordOfDay = getWordOfDay(trip, date);
  // More than one hotel can be assigned to the same day (comparing options,
  // a mid-stay switch) — same "render one per match" approach as cities.
  const hotelsToday = hotels.filter((h) => getHotelDates(h).includes(date));

  return (
    <div
      className={[
        'flex-1 border-l border-gray-100 dark:border-gray-800 first:border-l-0 flex flex-col transition-opacity duration-200',
        dimmed ? 'opacity-35' : '',
        isToday ? 'bg-blue-50/60 dark:bg-blue-950/30 border-t-2 border-t-red-600 dark:border-t-red-500' : '',
      ].join(' ')}
    >
      <div className="text-center pt-2 pb-1 px-1">
        <div className={['text-[10px] font-bold uppercase tracking-wider', isToday ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'].join(' ')}>
          {isToday ? 'Today' : weekday}
        </div>
        <div className={['text-sm font-bold leading-snug', isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'].join(' ')}>
          {monthDay}
        </div>
        {/* One column per city — badge on top, that city's weather directly
            beneath it — rather than a row of badges followed by a separate
            stack of weather lines, so on a multi-city day it's
            immediately clear which reading goes with which place. */}
        <div className="flex items-start justify-center gap-2 mt-0.5 flex-wrap">
          {cities.map((city) => {
            const colors = cityColor(city);
            const cityWeather = shownWeather?.find((w) => w.city === cityKey(city));
            return (
              <div key={cityKey(city)} className="flex flex-col items-center gap-0.5">
                {previousKeys.includes(cityKey(city)) ? (
                  <span
                    className={['my-1 inline-block h-1.5 w-1.5 rounded-full', colors.dot].join(' ')}
                    title={city.name}
                    aria-label={city.name}
                  />
                ) : (
                  <div
                    className={['inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide', colors.bg, colors.text].join(' ')}
                    title={city.name}
                  >
                    <span className={['w-1 h-1 rounded-full', colors.dot].join(' ')} />
                    {city.name}
                  </div>
                )}
                {cityWeather && (() => {
                  const { icon, label } = weatherCodeInfo(cityWeather.code);
                  return (
                    <div
                      className="flex flex-col items-center text-[10px] text-gray-500 dark:text-gray-400"
                      title={`${label} — ${city.name} (${weatherKindLabel(cityWeather.kind)})`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{icon}</span>
                        <span className="font-medium">{cityWeather.high}°</span>
                        <span className="text-gray-300 dark:text-gray-600">/{cityWeather.low}°</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        {shownWeather && shownWeather.length > 0 && (
          <div ref={chooserRef} className="relative mt-1 inline-block">
            <button
              onClick={() => {
                if (hourlyActive) onOpenHourly(); // turns it off
                else if (cities.length > 1) setChoosingCity((o) => !o);
                else onOpenHourly(cities[0] ? cityKey(cities[0]) : undefined);
              }}
              className={[
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition-colors',
                hourlyActive
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40',
              ].join(' ')}
              title={hourlyActive ? 'Hide the hourly weather' : 'See the weather hour by hour'}
              aria-pressed={hourlyActive}
              aria-haspopup={cities.length > 1 && !hourlyActive ? 'menu' : undefined}
            >
              <Clock size={9} />
              {hourlyLoading ? 'Loading…' : hourlyActive ? 'Hide hourly weather' : 'Hourly weather'}
            </button>
            {choosingCity && !hourlyActive && (
              <div
                role="menu"
                className="absolute left-1/2 top-full z-30 mt-1 w-40 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <p className="px-2.5 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Hourly weather for
                </p>
                {cities.map((city) => (
                  <button
                    key={cityKey(city)}
                    role="menuitem"
                    onClick={() => {
                      setChoosingCity(false);
                      onOpenHourly(cityKey(city));
                    }}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <span className={['h-1.5 w-1.5 shrink-0 rounded-full', cityColor(city).dot].join(' ')} />
                    <span className="truncate">{city.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {hotelsToday.length > 0 && (
          <div className="flex items-center justify-center gap-1 mt-1 flex-wrap px-0.5">
            {hotelsToday.map((hotel) => (
              <button
                key={hotel.id}
                onClick={() => onHotelClick(hotel)}
                title={`${hotel.name} — tap to view`}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors max-w-full"
              >
                <span className="shrink-0">🏨</span>
                <span className="truncate">{hotel.name}</span>
              </button>
            ))}
          </div>
        )}
        {isToday && wordOfDay && (
          <div
            className="mt-0.5 px-1 text-[9px] leading-tight text-gray-400 dark:text-gray-500 truncate"
            title={`${wordOfDay.language} word of the day: ${wordOfDay.word} — ${wordOfDay.translation}`}
          >
            <span className="font-semibold text-gray-500 dark:text-gray-400">{wordOfDay.word}</span>
            {' · '}
            {wordOfDay.translation}
          </div>
        )}
      </div>
      <div className="px-1.5 pb-1.5">
        {/* Map for just this day */}
        <button
          onClick={onOpenMap}
          className="mb-0.5 flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[9px] font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          title="See this day on a map"
        >
          <MapIcon size={9} />
          See this day on a map
        </button>
        {editing ? (
          <textarea
            autoFocus
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            onBlur={(e) => { setEditing(false); onNoteCommit(e.target.value); }}
            rows={2}
            placeholder="Travelpad for this day…"
            className="w-full text-[9px] text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-1 outline-none resize-none leading-tight placeholder-gray-300 dark:placeholder-gray-600 shadow-sm"
          />
        ) : (
          <button
            onClick={() => !readOnly && setEditing(true)}
            disabled={readOnly}
            className="group w-full text-left text-[9px] leading-tight rounded px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
          >
            {note && (
              <span className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap block mb-0.5">{note}</span>
            )}
            {!readOnly && (
              <span className="flex items-center gap-1 text-gray-300 dark:text-gray-600 italic group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors">
                <Pencil size={8} />
                Travelpad
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// A delete right away, plus a few seconds of holding onto the deleted row so
// an "Undo" toast can restore it — see handleAttractionDeleted/
// handleHotelDeleted below for why this deletes for real up front rather
// than just delaying the server call (durability: closing the tab right
// after deleting shouldn't leave a "ghost" row nobody else can see was ever
// removed).
interface PendingDelete {
  id: string;
  kind: 'attraction' | 'hotel';
  name: string;
  data: Attraction | Hotel;
  timeoutId: ReturnType<typeof setTimeout>;
}

const UNDO_WINDOW_MS = 7000;
// Width of the time-label gutter: plain, and wide enough for hourly weather.
const TIME_LABELS_PX = 64;
const TIME_LABELS_HOURLY_PX = 112;

export default function CalendarBoard({
  initialAttractions,
  weather,
  travelSegments,
  initialDayNotes,
  initialHotels,
  guideEnabled,
  placesEnabled,
  people,
  currentUserId,
}: {
  people: TripPerson[];
  currentUserId: string;
  guideEnabled: boolean;
  placesEnabled: boolean;
  initialAttractions: Attraction[];
  weather: Record<string, DayWeather[]>;
  travelSegments: Record<string, TravelSegment>;
  initialDayNotes: Record<string, string>;
  initialHotels: Hotel[];
}) {
  const [attractions, setAttractions] = useState(initialAttractions);
  const [activeAttraction, setActiveAttraction] = useState<Attraction | null>(null);
  const [editingAttraction, setEditingAttraction] = useState<Attraction | null>(null);
  const [hotels, setHotels] = useState(initialHotels);
  const [hotelModalState, setHotelModalState] = useState<
    { mode: 'add' } | { mode: 'edit'; hotel: Hotel } | null
  >(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [createSlot, setCreateSlot] = useState<{ date: string; time: string } | null>(null);
  // The day whose map is open (null = closed).
  const [mapDate, setMapDate] = useState<string | null>(null);
  // The day whose hourly weather is open (null = closed).
  const [hourlyDate, setHourlyDate] = useState<string | null>(null);
  const [hourly, setHourly] = useState<HourlyWeather[] | null>(null);
  // Which city's hours are showing, when the day has more than one (a cityKey).
  const [hourlyCity, setHourlyCity] = useState<string | null>(null);
  const hourlyRequest = useRef<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showPacking, setShowPacking] = useState(false);
  // An event Aero suggested, opened in the normal add-event form for review.
  const [guideSuggestion, setGuideSuggestion] = useState<GuideSuggestion | null>(null);
  const [colWidth, setColWidth] = useState(200);
  // Doubles as both the drag/resize conflict notice and a generic error toast
  // for failed writes (move, resize, check, day note) — same transient banner.
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<PendingDelete[]>([]);
  const pendingDeletesRef = useRef<PendingDelete[]>([]);
  // Defaults assume desktop; the resize effect below corrects for the
  // actual viewport right after mount so this can render on the server.
  const [daysPerPage, setDaysPerPage] = useState(DAYS_PER_PAGE);
  // Starts closed: on mobile this is the correct resting state already (no
  // open-then-slam-shut flash on mount), and on desktop the sidebar is always
  // visible regardless of this flag (forced by `sm:translate-x-0` below).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [travelModes, setTravelModes] = useState<Record<string, TravelMode>>({});
  const [dayNotes, setDayNotes] = useState<Record<string, string>>(initialDayNotes);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const isOnline = useOnlineStatus();
  const { trip, dates: TRIP_DATES, nextDate, homeShiftMinutes } = useTrip();
  const now = useNowInZone(trip.timezone);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  // Tracks whether the initial "jump to today's page" has happened yet, so
  // later window resizes fall back to the normal reset-to-page-0 behavior
  // instead of yanking the user back to today every time they resize.
  const hasJumpedToToday = useRef(false);
  const {
    permission: notifyPermission,
    subscribed: notifySubscribed,
    enable: enablePushNotifications,
    disable: disablePushNotifications,
  } = usePushNotifications();

  useEffect(() => {
    try { setTravelModes(JSON.parse(localStorage.getItem('vienna-travel-modes') ?? '{}')); } catch {}
    // Left over from the removed "Show categories" filter — clear it out.
    try { localStorage.removeItem('vienna-hidden-categories'); } catch {}
  }, []);

  // Records the last moment the app was confirmed online, so the offline
  // banner can tell you how stale the cached view you're looking at is
  // (rather than just "you're offline" with no sense of when it last synced).
  useEffect(() => {
    if (!isOnline) {
      try {
        const stored = localStorage.getItem('vienna-last-synced');
        if (stored) setLastSynced(Number(stored));
      } catch {}
      return;
    }
    const nowMs = Date.now();
    try { localStorage.setItem('vienna-last-synced', String(nowMs)); } catch {}
    setLastSynced(nowMs);
  }, [isOnline]);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const next = w < 640 ? 1 : w < 1024 ? 2 : DAYS_PER_PAGE;
      setDaysPerPage((prev) => {
        if (!hasJumpedToToday.current) {
          // On first load, open straight to whichever page today falls on
          // (if today's within the trip) instead of always starting at
          // page 1 — the whole point of this view is "what's happening now."
          setCurrentPage(pageForDate(TRIP_DATES, getNowInZone(trip.timezone).date, next));
        } else if (prev !== next) {
          setCurrentPage(0);
        }
        return next;
      });
      hasJumpedToToday.current = true;
      setSidebarOpen(w >= 640);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [TRIP_DATES, trip.timezone]);

  // Opens straight to a specific event when the page was loaded via a
  // shared link (?event=<id>, copied from EditModal's link button) —
  // recomputes the breakpoint locally rather than reading `daysPerPage`
  // state so it lands on the right page even before that state has been
  // corrected for the actual viewport (same reasoning as the effect above).
  // Runs after the "jump to today" effect so a shared link always wins over
  // the default today-page behavior.
  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get('event');
    if (!eventId) return;
    const target = attractions.find((a) => a.id === eventId);
    if (target) {
      setEditingAttraction(target);
      if (target.scheduled_date) {
        const w = window.innerWidth;
        const dpp = w < 640 ? 1 : w < 1024 ? 2 : DAYS_PER_PAGE;
        setCurrentPage(pageForDate(TRIP_DATES, target.scheduled_date, dpp));
      }
    }
    window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Keeps a ref mirror of pendingDeletes so the unmount cleanup below can see
  // whatever's currently pending without needing to run on every change.
  useEffect(() => {
    pendingDeletesRef.current = pendingDeletes;
  }, [pendingDeletes]);

  useEffect(() => {
    return () => {
      pendingDeletesRef.current.forEach((p) => clearTimeout(p.timeoutId));
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('vienna-travel-modes', JSON.stringify(travelModes));
  }, [travelModes]);

  // Realtime: sync changes made on your other devices
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`attractions-realtime-${trip.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attractions', filter: `trip_id=eq.${trip.id}` }, (payload: any) => {
        const row = payload.new as Attraction;
        if (!canSeeAttraction(row, currentUserId)) return;
        setAttractions((prev) => prev.find((a) => a.id === row.id) ? prev : [...prev, row]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attractions', filter: `trip_id=eq.${trip.id}` }, (payload: any) => {
        const row = payload.new as Attraction;
        // Someone narrowed who can see it and that no longer includes you.
        if (!canSeeAttraction(row, currentUserId)) {
          setAttractions((prev) => prev.filter((a) => a.id !== row.id));
          return;
        }
        setAttractions((prev) => prev.some((a) => a.id === row.id) ? prev.map((a) => a.id === row.id ? row : a) : [...prev, row]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attractions' }, (payload: any) => {
        const id = (payload.old as { id: string }).id;
        setAttractions((prev) => prev.filter((a) => a.id !== id));
      })
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [trip.id, currentUserId]);

  // Realtime: sync day notes made on your other devices
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const upsertNote = (payload: any) => {
      const row = payload.new as DayNote;
      setDayNotes((prev) => ({ ...prev, [row.date]: row.note }));
    };

    const channel = client
      .channel(`day-notes-realtime-${trip.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'day_notes', filter: `trip_id=eq.${trip.id}` }, upsertNote)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'day_notes', filter: `trip_id=eq.${trip.id}` }, upsertNote)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'day_notes' }, (payload: any) => {
        const date = (payload.old as { date: string }).date;
        setDayNotes((prev) => {
          const next = { ...prev };
          delete next[date];
          return next;
        });
      })
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [trip.id]);

  // Realtime: sync hotels changed on your other devices
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`hotels-realtime-${trip.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hotels', filter: `trip_id=eq.${trip.id}` }, (payload: any) => {
        const row = payload.new as Hotel;
        setHotels((prev) => prev.find((h) => h.id === row.id) ? prev : [...prev, row]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hotels', filter: `trip_id=eq.${trip.id}` }, (payload: any) => {
        const row = payload.new as Hotel;
        setHotels((prev) => prev.map((h) => h.id === row.id ? row : h));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hotels' }, (payload: any) => {
        const id = (payload.old as { id: string }).id;
        setHotels((prev) => prev.filter((h) => h.id !== id));
      })
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [trip.id]);

  const handleHotelSaved = (hotel: Hotel) => {
    setHotels((prev) => {
      const idx = prev.findIndex((h) => h.id === hotel.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = hotel;
        return next;
      }
      return [...prev, hotel];
    });
  };

  const handleHotelDeleted = (deleted: Hotel) => {
    setHotels((prev) => prev.filter((h) => h.id !== deleted.id));
    const timeoutId = setTimeout(() => {
      setPendingDeletes((prev) => prev.filter((p) => p.id !== deleted.id));
    }, UNDO_WINDOW_MS);
    setPendingDeletes((prev) => [...prev, { id: deleted.id, kind: 'hotel', name: deleted.name, data: deleted, timeoutId }]);
  };

  const updateDayNote = (date: string, text: string) => {
    setDayNotes((prev) => ({ ...prev, [date]: text }));
  };

  const commitDayNote = (date: string, text: string) => {
    startTransition(async () => {
      try {
        await upsertDayNote(trip.id, date, text, getEditorName());
      } catch {
        setToastMsg("Couldn't save your travelpad — check your connection and try again.");
      }
    });
  };

  // Same button turns hourly weather on for a day and off again.
  const toggleHourly = (date: string, city?: string) => {
    if (hourlyDate === date) {
      hourlyRequest.current = null;
      setHourlyDate(null);
      setHourly(null);
      setHourlyCity(null);
      return;
    }
    hourlyRequest.current = date;
    setHourlyDate(date);
    setHourly(null);
    setHourlyCity(city ?? null);
    const giveUp = (message: string) => {
      if (hourlyRequest.current !== date) return; // the choice changed meanwhile
      hourlyRequest.current = null;
      setHourlyDate(null);
      setToastMsg(message);
    };
    getDayHourly(trip.id, date)
      .then((data) => {
        if (hourlyRequest.current !== date) return;
        if (data.length === 0) giveUp('No hourly weather is available for that day yet.');
        else if (city && !data.some((d) => d.city === city)) giveUp(`No hourly weather is available for ${city.split('|')[0]} yet.`);
        else setHourly(data);
      })
      .catch(() => giveUp("Couldn't load the hourly weather — try again in a moment."));
  };

  const updateTravelMode = (pairKey: string, mode: TravelMode) => {
    setTravelModes((prev) => ({ ...prev, [pairKey]: mode }));
  };

  const totalPages = Math.ceil(TRIP_DATES.length / daysPerPage);
  const visibleDates = TRIP_DATES.slice(
    currentPage * daysPerPage,
    (currentPage + 1) * daysPerPage
  );

  // Hourly weather for one chosen day, shown beside the time labels while the
  // other days fade back. Only counts while that day is on screen.
  const hourlyVisible = !!hourlyDate && visibleDates.includes(hourlyDate);
  const hourlyShown = hourlyVisible && !!hourly;
  const activeHourly = hourly?.find((h) => h.city === hourlyCity) ?? hourly?.[0] ?? null;
  const labelWidthPx = hourlyShown ? TIME_LABELS_HOURLY_PX : TIME_LABELS_PX;

  // Keep colWidth in sync with the actual rendered column width
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setColWidth(Math.max(80, (el.offsetWidth - labelWidthPx) / visibleDates.length));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, labelWidthPx]); // re-measure whenever the page (and thus column count) or label width changes

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch requires a long press before a drag starts, so a normal swipe
    // still scrolls the calendar instead of picking up the event underneath.
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  );


  const scheduledByDate = TRIP_DATES.reduce<Record<string, Attraction[]>>((acc, date) => {
    acc[date] = attractions.filter((a) => a.scheduled_date === date);
    return acc;
  }, {});

  // The very next timed event from this moment on (today's remaining events,
  // then whichever day comes after) — lets someone check "what's coming up"
  // without paging through the calendar. `now` is null until mounted
  // client-side, so this stays empty during the server render.
  const nextEvent = useMemo(() => {
    if (!now) return null;
    const upcoming = attractions
      .filter((a) => a.scheduled_date && a.start_time)
      .filter(
        (a) =>
          a.scheduled_date! > now.date ||
          (a.scheduled_date === now.date && timeToMinutes(a.start_time!) >= now.minutes)
      )
      .sort((a, b) => {
        const dateCompare = a.scheduled_date!.localeCompare(b.scheduled_date!);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time!.localeCompare(b.start_time!);
      });
    return upcoming[0] ?? null;
  }, [attractions, now]);

  // "Today"/"Tomorrow" when applicable (most common case, since this is
  // "what's next"), otherwise the weekday — the chip covers events days
  // away too (e.g. right after the trip's last event of a given day passes),
  // so the day needs to be visible, not just the time.
  const nextEventDayLabel = useMemo(() => {
    if (!nextEvent || !now) return null;
    if (nextEvent.scheduled_date === now.date) return 'Today';
    if (nextEvent.scheduled_date === nextDate(now.date)) return 'Tomorrow';
    return formatDate(nextEvent.scheduled_date!).weekday;
  }, [nextEvent, now, nextDate]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveAttraction(attractions.find((a) => a.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAttraction(null);
    if (!over) return;

    const attractionId = active.id as string;
    const attraction = attractions.find((a) => a.id === attractionId);
    if (!attraction) return;

    const overId = over.id as string;
    let newDate: string | null;
    let newStartTime: string | null;
    let newEndTime: string | null;

    if (overId.includes('T')) {
      const splitIdx = overId.indexOf('T');
      const date = overId.slice(0, splitIdx);
      const time = overId.slice(splitIdx + 1);
      const duration = attraction.start_time
        ? getDuration(attraction.start_time, attraction.end_time)
        : DEFAULT_DURATION_MINUTES;
      // Preserve the event's full duration: if dropping here would push the
      // end past the grid, slide the start back instead of shrinking it.
      const gridEndMinutes = GRID_END_HOUR * 60;
      const gridStartMinutes = GRID_START_HOUR * 60;
      let startMinutes = timeToMinutes(time);
      if (startMinutes + duration > gridEndMinutes) {
        startMinutes = Math.max(gridStartMinutes, gridEndMinutes - duration);
      }
      newDate = date;
      newStartTime = minutesToTime(startMinutes);
      newEndTime = minutesToTime(startMinutes + duration);
    } else {
      newDate = overId; newStartTime = null; newEndTime = null;
    }

    if (
      attraction.scheduled_date === newDate &&
      attraction.start_time === newStartTime &&
      attraction.end_time === newEndTime
    ) return;

    if (newDate && newStartTime) {
      const conflict = findTimeConflict(attractions, newDate, newStartTime, newEndTime, attractionId);
      if (conflict) {
        setToastMsg(`Can't move here — overlaps with "${conflict.name}"`);
        return;
      }
    }

    const previous = { scheduled_date: attraction.scheduled_date, start_time: attraction.start_time, end_time: attraction.end_time };

    setAttractions((prev) =>
      prev.map((a) =>
        a.id === attractionId
          ? { ...a, scheduled_date: newDate, start_time: newStartTime, end_time: newEndTime }
          : a
      )
    );

    startTransition(async () => {
      try {
        await updateAttraction(
          attractionId,
          {
            scheduled_date: newDate,
            start_time: newStartTime,
            end_time: newEndTime,
          },
          getEditorName()
        );
      } catch {
        // Roll back to where it was before the drag — otherwise the card sits
        // in its new spot on this screen while the database still has the old
        // slot, so it'll "jump back" as soon as anyone else's edit syncs in.
        setAttractions((prev) => prev.map((a) => (a.id === attractionId ? { ...a, ...previous } : a)));
        setToastMsg("Couldn't move — check your connection and try again.");
      }
    });
  };

  const handleAttractionResize = (id: string, newEndTime: string) => {
    const attraction = attractions.find((a) => a.id === id);
    const previousEndTime = attraction?.end_time ?? null;

    setAttractions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, end_time: newEndTime } : a))
    );
    startTransition(async () => {
      try {
        await updateAttraction(id, { end_time: newEndTime }, getEditorName());
      } catch {
        setAttractions((prev) => prev.map((a) => (a.id === id ? { ...a, end_time: previousEndTime } : a)));
        setToastMsg("Couldn't resize — check your connection and try again.");
      }
    });
  };

  const handleAttractionDeleted = (deleted: Attraction) => {
    setAttractions((prev) => prev.filter((a) => a.id !== deleted.id));
    if (editingAttraction?.id === deleted.id) setEditingAttraction(null);
    const timeoutId = setTimeout(() => {
      setPendingDeletes((prev) => prev.filter((p) => p.id !== deleted.id));
    }, UNDO_WINDOW_MS);
    setPendingDeletes((prev) => [...prev, { id: deleted.id, kind: 'attraction', name: deleted.name, data: deleted, timeoutId }]);
  };

  const handleAttractionUpdated = (updated: Attraction) => {
    setAttractions((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleAttractionCreated = (attraction: Attraction) => {
    setAttractions((prev) => [...prev, attraction]);
  };

  // Undoing re-inserts the exact row that was just deleted (same id and
  // all) — a real database insert, so every other family member's device
  // just sees it come back through the same realtime INSERT handling that
  // already exists for brand-new events, no special-casing needed there.
  const handleUndoDelete = (pending: PendingDelete) => {
    clearTimeout(pending.timeoutId);
    setPendingDeletes((prev) => prev.filter((p) => p.id !== pending.id));
    startTransition(async () => {
      try {
        if (pending.kind === 'attraction') {
          const restored = await restoreAttraction(pending.data as Attraction);
          handleAttractionCreated(restored);
        } else {
          const restored = await restoreHotel(pending.data as Hotel);
          handleHotelSaved(restored);
        }
      } catch {
        setToastMsg(`Couldn't restore "${pending.name}" — try again.`);
      }
    });
  };

  return (
    <>
      <DndContext
        id="calendar-board-dnd"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900 relative">
          {/* Backdrop for mobile sidebar */}
          {sidebarOpen && (
            <div
              className="sm:hidden absolute inset-0 z-40 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar: always visible on sm+, overlay on mobile */}
          <div className={[
            'z-50 h-full sm:static absolute top-0 left-0 transition-transform duration-200',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          ].join(' ')}>
            <HotelsSidebar
              hotels={hotels}
              onAddHotel={() => { setHotelModalState({ mode: 'add' }); setSidebarOpen(false); }}
              onHotelClick={(hotel) => { setHotelModalState({ mode: 'edit', hotel }); setSidebarOpen(false); }}
              onClose={() => setSidebarOpen(false)}
              readOnly={!isOnline}
            />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {!isOnline && (
              <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-3 py-1.5 text-amber-800 dark:text-amber-300 text-xs shrink-0">
                <WifiOff size={13} className="shrink-0" />
                You&apos;re offline — viewing cached data{lastSynced ? ` from ${timeAgo(lastSynced)}` : ''}, read-only until you&apos;re back online.
              </div>
            )}
            {/* Utility bar — search and the less time-critical controls live
                here, above the main nav strip, so day-to-day navigation
                isn't competing with them for space. There's no timezone
                toggle anymore: every event just shows local time,
                except one flagged "show in Eastern" (e.g. a return flight)
                which always renders in ET regardless — a fixed per-event
                pin instead of a global switch, since the two timezones
                represent permanently different things, not a preference to
                flip back and forth. */}
            <div className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-950/40 border-b border-gray-100 dark:border-gray-800 px-2 py-1 shrink-0">
              {/* Night mode — far left of the toolbar. */}
              <ThemeToggle bordered />

              {/* "Up next" — the very next timed event from now, so you can
                  tell what's coming without paging through the calendar.
                  Clicking it jumps straight to that event. Hidden once
                  there's nothing left to look forward to (e.g. after the
                  trip's last event has passed). Wrapped in a flex-1
                  container so it still centers in the space left of the alerts bell, but the pill itself only grows to fit its
                  content (capped) rather than stretching full-width — kept
                  visually quiet (gray, not blue) so it doesn't compete with
                  actual buttons. */}
              {nextEvent && (
                <div className="flex-1 min-w-0 flex justify-center px-1">
                  <button
                    onClick={() => {
                      setCurrentPage(pageForDate(TRIP_DATES, nextEvent.scheduled_date!, daysPerPage));
                      setEditingAttraction(nextEvent);
                    }}
                    className="flex items-center gap-1.5 max-w-[65vw] sm:max-w-[280px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title={`Up next: ${nextEvent.name}`}
                  >
                    <ArrowRight size={11} className="shrink-0 text-blue-500 dark:text-blue-400" />
                    <span className="text-[11px] font-medium truncate">{nextEvent.name}</span>
                    <span className="text-[11px] opacity-70 shrink-0 tabular-nums">
                      {nextEventDayLabel} · {formatTimeInZone(nextEvent.start_time!, nextEvent.departure_timezone, homeShiftMinutes)}
                    </span>
                  </button>
                </div>
              )}

              {/* Event alerts bell — on the opposite side of the toolbar from search. */}
              <NotificationsMenu
                notifyPermission={notifyPermission}
                notifySubscribed={notifySubscribed}
                onEnableNotifications={enablePushNotifications}
                onDisableNotifications={disablePushNotifications}
              />
            </div>

            {/* Main nav strip — sidebar toggle, day navigation, add event, jump to today */}
            <div className="flex items-center bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-2 py-1.5 shrink-0">
              {/* Sidebar toggle — only useful on mobile since sidebar is always visible on desktop */}
              <button
                onClick={() => setSidebarOpen((o) => !o)}
                className="sm:hidden p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                title="Lodging"
              >
                <PanelLeftOpen size={20} />
              </button>
              <button
                onClick={() => { setShowPacking((v) => !v); setShowGuide(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold transition-colors"
                title="Your packing list"
              >
                <Luggage size={13} />
                <span className="hidden sm:inline">Packing list</span>
              </button>

              {/* Navigation — centered */}
              <div className="flex-1 flex items-center justify-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 disabled:opacity-25 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Previous"
                >
                  <FlightPathIcon direction="prev" size={24} />
                </button>
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 tabular-nums min-w-[3.5rem] text-center">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 disabled:opacity-25 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Next"
                >
                  <FlightPathIcon direction="next" size={24} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setShowGuide((v) => !v); setShowPacking(false); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-600/40 text-blue-600 hover:bg-blue-600/10 text-xs font-semibold transition-colors"
                  title="Ask Aero: questions, ideas and an itinerary check"
                >
                  Ask
                  <AeroPlaneIcon size={13} />
                  Aero
                </button>
                {/* Jump to today — only relevant while the trip is actually underway */}
                {now && TRIP_DATES.includes(now.date) && (
                  <button
                    onClick={() => setCurrentPage(pageForDate(TRIP_DATES, now.date, daysPerPage))}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    title="Jump to today"
                  >
                    <CalendarDays size={13} />
                    <span className="hidden sm:inline">Today</span>
                  </button>
                )}
              </div>
            </div>

            {/* Header row: time-label spacer + day names */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
              <div
                className="shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col items-center justify-end pb-1.5 text-center transition-[width] duration-200"
                style={{ width: labelWidthPx }}
              >
                {hourlyShown && hourly && activeHourly && (
                  <>
                    {hourly.length > 1 ? (
                      // More than one place that day: switch between them here.
                      <select
                        value={activeHourly.city}
                        onChange={(e) => setHourlyCity(e.target.value)}
                        aria-label="Which city's hourly weather"
                        className="w-[92%] truncate rounded border border-blue-200 bg-white px-0.5 py-0.5 text-[9px] font-semibold text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-400"
                      >
                        {hourly.map((h) => (
                          <option key={h.city} value={h.city}>{h.cityName}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="max-w-full truncate px-1 text-[9px] font-semibold text-blue-600 dark:text-blue-400">{activeHourly.cityName}</span>
                    )}
                    <span className="text-[9px] text-gray-400 dark:text-gray-500">{hourlyKindShort(activeHourly.kind)}</span>
                  </>
                )}
              </div>

              {visibleDates.map((date, i) => (
                <DayHeader
                  key={date}
                  date={date}
                  prevDate={i > 0 ? visibleDates[i - 1] : undefined}
                  note={dayNotes[date] ?? ''}
                  weather={weather[date]}
                  hotels={hotels}
                  onHotelClick={(hotel) => setHotelModalState({ mode: 'edit', hotel })}
                  onOpenMap={() => setMapDate(date)}
                  onOpenHourly={(city) => toggleHourly(date, city)}
                  hourlyActive={hourlyVisible && hourlyDate === date}
                  hourlyLoading={hourlyVisible && hourlyDate === date && !hourly}
                  dimmed={hourlyVisible && hourlyDate !== date}
                  onNoteChange={(v) => updateDayNote(date, v)}
                  onNoteCommit={(v) => commitDayNote(date, v)}
                  readOnly={!isOnline}
                  isToday={date === now?.date}
                />
              ))}
            </div>

            {/* Anytime-zone spacer in time-label column + scrollable grid */}
            <div ref={scrollRef} className="flex flex-1 overflow-y-auto overflow-x-hidden">
              <TimeLabels widthPx={labelWidthPx} hourly={hourlyShown ? (activeHourly?.hours ?? null) : null} />
              {visibleDates.map((date) => (
                <DayColumn
                  key={date}
                  date={date}
                  attractions={scheduledByDate[date] ?? []}
                  onAttractionClick={setEditingAttraction}
                  onTimeSlotClick={(d, t) => setCreateSlot({ date: d, time: t })}
                  onAttractionResize={handleAttractionResize}
                  travelSegments={travelSegments}
                  travelModes={travelModes}
                  onTravelModeChange={updateTravelMode}
                  readOnly={!isOnline}
                  nowMinutes={date === now?.date ? now.minutes : null}
                  dimmed={hourlyVisible && hourlyDate !== date}
                />
              ))}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeAttraction && (() => {
            const h = activeAttraction.start_time
              ? getEventHeight(activeAttraction.start_time, activeAttraction.end_time)
              : 72;
            const w = activeAttraction.start_time ? colWidth : 208;
            return (
              <div style={{ width: w }} className="pointer-events-none">
                <AttractionBlock
                  attraction={activeAttraction}
                  isOverlay
                  height={h}
                  startTimezone={activeAttraction.departure_timezone}
                  endTimezone={activeAttraction.arrival_timezone}
                />
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl pointer-events-none">
          {toastMsg}
        </div>
      )}

      {pendingDeletes.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2">
          {pendingDeletes.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium pl-4 pr-2 py-2 rounded-full shadow-xl"
            >
              <span>
                Deleted <span className="font-semibold">&quot;{p.name}&quot;</span>
              </span>
              <button
                onClick={() => handleUndoDelete(p)}
                className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 font-bold text-blue-300 hover:text-blue-200 transition-colors"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      {editingAttraction && (
        <EditModal
          people={people}
          currentUserId={currentUserId}
          attraction={editingAttraction}
          allAttractions={attractions}
          hotels={hotels}
          onClose={() => setEditingAttraction(null)}
          onSaved={(updated) => {
            handleAttractionUpdated(updated);
            setEditingAttraction(null);
          }}
          onDeleted={handleAttractionDeleted}
          readOnly={!isOnline}
        />
      )}

      {showPacking && <PackingPanel tripId={trip.id} onClose={() => setShowPacking(false)} />}

      {showGuide && (
        <GuidePanel
          tripId={trip.id}
          chatEnabled={guideEnabled}
          placesEnabled={placesEnabled}
          attractions={attractions}
          hotels={hotels}
          onAddSuggestion={setGuideSuggestion}
          onJumpToDate={(date) => setCurrentPage(pageForDate(TRIP_DATES, date, daysPerPage))}
          onClose={() => setShowGuide(false)}
        />
      )}

      {(createSlot || guideSuggestion) && (
        <CreateModal
          people={people}
          currentUserId={currentUserId}
          date={createSlot?.date ?? guideSuggestion?.date}
          startTime={createSlot?.time ?? (guideSuggestion?.start_time || undefined)}
          prefill={guideSuggestion ?? undefined}
          allAttractions={attractions}
          hotels={hotels}
          onClose={() => { setCreateSlot(null); setGuideSuggestion(null); }}
          onCreated={(attraction) => {
            handleAttractionCreated(attraction);
            setCreateSlot(null);
            setGuideSuggestion(null);
          }}
        />
      )}

      {mapDate && (
        <MapView
          attractions={attractions}
          hotels={hotels}
          initialDate={mapDate}
          onClose={() => setMapDate(null)}
        />
      )}


      {hotelModalState && (
        <HotelModal
          hotel={hotelModalState.mode === 'edit' ? hotelModalState.hotel : undefined}
          onClose={() => setHotelModalState(null)}
          onSaved={(hotel) => {
            handleHotelSaved(hotel);
            setHotelModalState(null);
          }}
          onDeleted={handleHotelDeleted}
        />
      )}
    </>
  );
}
