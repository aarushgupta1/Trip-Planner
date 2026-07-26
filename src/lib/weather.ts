import { CITY_INFO, TripCity, CITY_ORDER, getCitiesForDate } from './trip';

export interface DayWeather {
  city: TripCity;
  high: number; // °F
  low: number; // °F
  code: number; // WMO weather code
}

interface DailyBlock {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weathercode: number[];
}

// A date normally belongs to a single city, but a day-trip day (see
// CITY_SEGMENTS in trip.ts) can belong to more than one — so weather is
// fetched per (date, city) pair, and a date can map to more than one
// DayWeather entry.
//
// Only real forecasts are ever returned — Open-Meteo's forecast endpoint
// only covers `forecast_days=16`, so a date further out than that (e.g. a
// trip planned months ahead) simply has no entry yet rather than showing a
// guessed "typical weather" average in its place. The day header just shows
// nothing for that date until it's within the forecast window and the
// real numbers come back.
export async function getWeatherForDates(dates: string[]): Promise<Record<string, DayWeather[]>> {
  const result: Record<string, DayWeather[]> = {};
  if (dates.length === 0) return result;

  const pairs = dates.flatMap((d) => getCitiesForDate(d).map((city) => ({ date: d, city })));

  const byCity = new Map<TripCity, string[]>();
  for (const { date, city } of pairs) {
    byCity.set(city, [...(byCity.get(city) ?? []), date]);
  }

  await Promise.all(
    [...byCity.entries()].map(async ([city, cityDates]) => {
      const { lat, lng, timezone } = CITY_INFO[city];
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
            `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=${encodeURIComponent(timezone)}&forecast_days=16&temperature_unit=fahrenheit`,
          { next: { revalidate: 1800 } }
        );
        if (res.ok) {
          const data = (await res.json()) as { daily?: DailyBlock };
          const daily = data.daily;
          daily?.time.forEach((day, i) => {
            if (cityDates.includes(day)) {
              (result[day] ??= []).push({
                city,
                high: Math.round(daily.temperature_2m_max[i]),
                low: Math.round(daily.temperature_2m_min[i]),
                code: daily.weathercode[i],
              });
            }
          });
        }
      } catch {
        // Forecast unavailable for this city right now — its dates just stay
        // absent from `result` rather than falling back to a guess.
      }
    })
  );

  // Deterministic order (Vienna before Salzburg before Prague) regardless of
  // which city's fetch happened to resolve first above.
  for (const date of Object.keys(result)) {
    result[date].sort((a, b) => CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city));
  }

  return result;
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
