import { Trip, TripCity, cityKey, generateTripDates, getCitiesForDate, getCityOrder } from './trip';

export type WeatherKind = 'forecast' | 'observed' | 'typical';

export interface DayWeather {
  city: string; // cityKey() of the city this reading is for
  high: number; // °F
  low: number; // °F
  code: number; // WMO weather code
  // forecast: live forecast (within ~16 days); observed: recorded weather for
  // a day that has already happened; typical: average of the same calendar
  // days over the last 10 years, used when the trip is further out than any
  // forecast reaches.
  kind: WeatherKind;
}

interface DailyBlock {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  weathercode: (number | null)[];
}

interface Reading {
  high: number;
  low: number;
  code: number;
}

const DAY_MS = 86_400_000;
const FORECAST_DAYS = 16;
const FORECAST_PAST_DAYS = 90;
const HISTORY_YEARS = 10;

export function addDaysISO(date: string, days: number): string {
  return new Date(new Date(date + 'T00:00:00Z').getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export type WeatherSource = 'forecast' | 'archive' | 'typical';

// Which data source can answer for a given date. `today` is the date in the
// city's own timezone.
export function weatherSourceFor(date: string, today: string): WeatherSource {
  if (date > addDaysISO(today, FORECAST_DAYS - 1)) return 'typical';
  if (date >= addDaysISO(today, -FORECAST_PAST_DAYS)) return 'forecast';
  return 'archive';
}

// Same month/day in another year; null for Feb 29 in a non-leap year.
export function shiftYear(date: string, year: number): string | null {
  const shifted = `${year}${date.slice(4)}`;
  return new Date(shifted + 'T00:00:00Z').toISOString().slice(0, 10) === shifted ? shifted : null;
}

export function averageReadings(readings: Reading[]): Reading | null {
  if (readings.length === 0) return null;
  const high = readings.reduce((n, r) => n + r.high, 0) / readings.length;
  const low = readings.reduce((n, r) => n + r.low, 0) / readings.length;
  const counts = new Map<number, number>();
  for (const r of readings) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
  let code = readings[0].code;
  let best = 0;
  for (const [c, n] of counts) {
    if (n > best) {
      best = n;
      code = c;
    }
  }
  return { high: Math.round(high), low: Math.round(low), code };
}

function readDaily(daily: DailyBlock | undefined): Map<string, Reading> {
  const out = new Map<string, Reading>();
  daily?.time.forEach((day, i) => {
    const high = daily.temperature_2m_max[i];
    const low = daily.temperature_2m_min[i];
    const code = daily.weathercode[i];
    if (high == null || low == null || code == null) return;
    out.set(day, { high: Math.round(high), low: Math.round(low), code });
  });
  return out;
}

async function fetchDaily(url: string): Promise<Map<string, Reading>> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return new Map();
    const data = (await res.json()) as { daily?: DailyBlock };
    return readDaily(data.daily);
  } catch {
    return new Map();
  }
}

const DAILY = 'daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit';

function archiveUrl(city: TripCity, start: string, end: string): string {
  return (
    `https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat}&longitude=${city.lng}` +
    `&start_date=${start}&end_date=${end}&${DAILY}&timezone=${encodeURIComponent(city.timezone)}`
  );
}

function todayIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// A date normally belongs to a single city, but a day-trip day can belong
// to more than one — so weather is fetched per (date, city) pair, and a
// date can map to more than one DayWeather entry.
//
// Every date gets the best data that exists for it: a live forecast when it
// is within reach, recorded observations once it has passed, and otherwise
// the 10-year average for those calendar days (flagged `typical`).
export async function getWeatherForDates(trip: Pick<Trip, 'start_date' | 'end_date' | 'cities'>): Promise<Record<string, DayWeather[]>> {
  const result: Record<string, DayWeather[]> = {};
  const dates = generateTripDates(trip);
  if (dates.length === 0 || trip.cities.length === 0) return result;

  const byCity = new Map<string, { city: TripCity; dates: string[] }>();
  for (const date of dates) {
    for (const city of getCitiesForDate(trip.cities, date)) {
      const key = cityKey(city);
      const entry = byCity.get(key) ?? { city, dates: [] };
      entry.dates.push(date);
      byCity.set(key, entry);
    }
  }

  await Promise.all(
    [...byCity.entries()].map(async ([key, { city, dates: cityDates }]) => {
      const today = todayIn(city.timezone);
      const add = (date: string, r: Reading, kind: WeatherKind) => {
        (result[date] ??= []).push({ city: key, ...r, kind });
      };

      const forecastDates = cityDates.filter((d) => weatherSourceFor(d, today) === 'forecast');
      const archiveDates = cityDates.filter((d) => weatherSourceFor(d, today) === 'archive');
      const typicalDates = cityDates.filter((d) => weatherSourceFor(d, today) === 'typical');

      const tasks: Promise<void>[] = [];

      if (forecastDates.length > 0) {
        tasks.push(
          fetchDaily(
            `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}` +
              `&${DAILY}&timezone=${encodeURIComponent(city.timezone)}&past_days=${FORECAST_PAST_DAYS}&forecast_days=${FORECAST_DAYS}`
          ).then((data) => {
            for (const d of forecastDates) {
              const r = data.get(d);
              if (r) add(d, r, d < today ? 'observed' : 'forecast');
            }
          })
        );
      }

      if (archiveDates.length > 0) {
        const start = archiveDates[0];
        const end = archiveDates[archiveDates.length - 1];
        tasks.push(
          fetchDaily(archiveUrl(city, start, end)).then((data) => {
            for (const d of archiveDates) {
              const r = data.get(d);
              if (r) add(d, r, 'observed');
            }
          })
        );
      }

      if (typicalDates.length > 0) {
        const thisYear = Number(today.slice(0, 4));
        const samples = new Map<string, Reading[]>();
        const years = Array.from({ length: HISTORY_YEARS }, (_, i) => thisYear - 1 - i);
        const first = typicalDates[0];
        const last = typicalDates[typicalDates.length - 1];
        const yearTasks = years.map(async (year) => {
          const offset = year - Number(first.slice(0, 4));
          const start = shiftYear(first, Number(first.slice(0, 4)) + offset);
          const lastYear = Number(last.slice(0, 4)) + offset;
          const end = shiftYear(last, lastYear) ?? shiftYear(addDaysISO(last, -1), lastYear);
          if (!end) return;
          if (!start) return;
          const data = await fetchDaily(archiveUrl(city, start, end));
          for (const d of typicalDates) {
            const shifted = shiftYear(d, Number(d.slice(0, 4)) + offset);
            const r = shifted ? data.get(shifted) : undefined;
            if (r) (samples.get(d) ?? samples.set(d, []).get(d)!).push(r);
          }
        });
        tasks.push(
          Promise.all(yearTasks).then(() => {
            for (const d of typicalDates) {
              const avg = averageReadings(samples.get(d) ?? []);
              if (avg) add(d, avg, 'typical');
            }
          })
        );
      }

      await Promise.all(tasks);
    })
  );

  // Deterministic order (same as the day-header badges) regardless of which
  // city's fetch happened to resolve first above.
  const order = getCityOrder(trip.cities).map(cityKey);
  for (const date of Object.keys(result)) {
    result[date].sort((a, b) => order.indexOf(a.city) - order.indexOf(b.city));
  }

  return result;
}

export function weatherKindLabel(kind: WeatherKind): string {
  if (kind === 'forecast') return 'Forecast';
  if (kind === 'observed') return 'Recorded';
  return 'Typical for this time of year (10-year average)';
}

// WMO weather interpretation codes: https://open-meteo.com/en/docs
export function weatherCodeInfo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Clear' };
  if (code === 1) return { icon: '🌤️', label: 'Mostly clear' };
  if (code === 2) return { icon: '⛅', label: 'Partly cloudy' };
  if (code === 3) return { icon: '☁️', label: 'Overcast' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Fog' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', label: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: 'Showers' };
  if (code === 85 || code === 86) return { icon: '🌨️', label: 'Snow showers' };
  if (code >= 95) return { icon: '⛈️', label: 'Storm' };
  return { icon: '🌡️', label: 'Unknown' };
}
