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

// ---- Hour-by-hour weather for a single day ----

export interface HourlyPoint {
  hour: number; // 0–23, local to the city
  temp: number; // °F
  code: number; // WMO weather code
  // Forecasts give a chance of rain; recorded and typical days give how much
  // actually fell (inches).
  rain: { kind: 'chance' | 'amount'; value: number } | null;
}

export interface HourlyWeather {
  city: string; // cityKey()
  cityName: string;
  kind: WeatherKind;
  hours: HourlyPoint[];
}

interface HourlyBlock {
  time: string[];
  temperature_2m: (number | null)[];
  weather_code?: (number | null)[];
  weathercode?: (number | null)[];
  precipitation_probability?: (number | null)[];
  precipitation?: (number | null)[];
}

// Open-Meteo hourly block → points. `rain` says which rain field to read.
export function parseHourlyBlock(block: HourlyBlock | undefined, rain: 'chance' | 'amount'): HourlyPoint[] {
  if (!block?.time) return [];
  const codes = block.weather_code ?? block.weathercode ?? [];
  const out: HourlyPoint[] = [];
  block.time.forEach((t, i) => {
    const temp = block.temperature_2m[i];
    const code = codes[i];
    if (temp == null || code == null) return;
    const raw = rain === 'chance' ? block.precipitation_probability?.[i] : block.precipitation?.[i];
    out.push({
      hour: Number(t.slice(11, 13)),
      temp: Math.round(temp),
      code,
      rain: raw == null ? null : { kind: rain, value: rain === 'chance' ? Math.round(raw) : Math.round(raw * 100) / 100 },
    });
  });
  return out;
}

// Same hour across several years → one "typical" hour: mean temperature and
// rainfall, most common weather code.
export function averageHourly(days: HourlyPoint[][]): HourlyPoint[] {
  const out: HourlyPoint[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const samples = days.map((d) => d.find((p) => p.hour === hour)).filter((p): p is HourlyPoint => !!p);
    if (samples.length === 0) continue;
    const avg = averageReadings(samples.map((p) => ({ high: p.temp, low: p.temp, code: p.code })));
    const rains = samples.map((p) => p.rain?.value).filter((v): v is number => typeof v === 'number');
    out.push({
      hour,
      temp: avg!.high,
      code: avg!.code,
      rain: rains.length ? { kind: 'amount', value: Math.round((rains.reduce((a, b) => a + b, 0) / rains.length) * 100) / 100 } : null,
    });
  }
  return out;
}

const HOURLY = 'hourly=temperature_2m,weather_code,precipitation_probability,precipitation&temperature_unit=fahrenheit&precipitation_unit=inch';

async function fetchHourly(url: string, rain: 'chance' | 'amount'): Promise<HourlyPoint[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { hourly?: HourlyBlock };
    return parseHourlyBlock(data.hourly, rain);
  } catch {
    return [];
  }
}

// Best data for the day, same rule as the daily numbers: a live forecast when
// it's within reach, recorded hours once it has passed, otherwise the
// 10-year average for that date.
export async function getHourlyWeather(city: TripCity, date: string): Promise<HourlyWeather | null> {
  const today = todayIn(city.timezone);
  const source = weatherSourceFor(date, today);
  const tz = encodeURIComponent(city.timezone);
  const where = `latitude=${city.lat}&longitude=${city.lng}&timezone=${tz}`;
  const base = { city: cityKey(city), cityName: city.name };

  if (source === 'forecast') {
    const kind: WeatherKind = date < today ? 'observed' : 'forecast';
    const hours = await fetchHourly(
      `https://api.open-meteo.com/v1/forecast?${where}&${HOURLY}&start_date=${date}&end_date=${date}`,
      kind === 'forecast' ? 'chance' : 'amount'
    );
    return hours.length ? { ...base, kind, hours } : null;
  }

  if (source === 'archive') {
    const hours = await fetchHourly(
      `https://archive-api.open-meteo.com/v1/archive?${where}&${HOURLY}&start_date=${date}&end_date=${date}`,
      'amount'
    );
    return hours.length ? { ...base, kind: 'observed', hours } : null;
  }

  const thisYear = Number(today.slice(0, 4));
  const days = await Promise.all(
    Array.from({ length: HISTORY_YEARS }, (_, i) => thisYear - 1 - i).map((year) => {
      const shifted = shiftYear(date, year);
      return shifted
        ? fetchHourly(`https://archive-api.open-meteo.com/v1/archive?${where}&${HOURLY}&start_date=${shifted}&end_date=${shifted}`, 'amount')
        : Promise.resolve([] as HourlyPoint[]);
    })
  );
  const hours = averageHourly(days.filter((d) => d.length > 0));
  return hours.length ? { ...base, kind: 'typical', hours } : null;
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
