import { Trip, TripCity, cityKey, generateTripDates, getCitiesForDate, getCityOrder } from './trip';

export interface DayWeather {
  city: string; // cityKey() of the city this reading is for
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

// A date normally belongs to a single city, but a day-trip day can belong
// to more than one — so weather is fetched per (date, city) pair, and a
// date can map to more than one DayWeather entry.
//
// Only real forecasts are ever returned — Open-Meteo's forecast endpoint
// only covers `forecast_days=16`, so a date further out than that simply
// has no entry yet rather than showing a guessed "typical weather" average.
// The day header just shows nothing for that date until it's within the
// forecast window and the real numbers come back.
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
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}` +
            `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=${encodeURIComponent(city.timezone)}&forecast_days=16&temperature_unit=fahrenheit`,
          { next: { revalidate: 1800 } }
        );
        if (res.ok) {
          const data = (await res.json()) as { daily?: DailyBlock };
          const daily = data.daily;
          daily?.time.forEach((day, i) => {
            if (cityDates.includes(day)) {
              (result[day] ??= []).push({
                city: key,
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

  // Deterministic order (same as the day-header badges) regardless of which
  // city's fetch happened to resolve first above.
  const order = getCityOrder(trip.cities).map(cityKey);
  for (const date of Object.keys(result)) {
    result[date].sort((a, b) => order.indexOf(a.city) - order.indexOf(b.city));
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
