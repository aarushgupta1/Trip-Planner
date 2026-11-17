import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  PIXELS_PER_HOUR,
  formatHour,
} from '@/lib/timeUtils';
import { HourlyPoint, weatherCodeInfo } from '@/lib/weather';

// The hour labels down the left edge. While a day's hourly weather is on, each
// hour also shows its weather right beside the time.
export default function TimeLabels({ widthPx = 64, hourly = null }: { widthPx?: number; hourly?: HourlyPoint[] | null }) {
  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR },
    (_, i) => GRID_START_HOUR + i
  );
  const totalHeight = (GRID_END_HOUR - GRID_START_HOUR) * PIXELS_PER_HOUR;

  return (
    <div
      className="shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-[width] duration-200"
      style={{ height: totalHeight, width: widthPx }}
    >
      {hours.map((hour, i) => {
        const point = hourly?.find((p) => p.hour === hour);
        const info = point ? weatherCodeInfo(point.code) : null;
        const rain = point?.rain && point.rain.value > 0
          ? point.rain.kind === 'chance'
            ? `, ${point.rain.value}% chance of rain`
            : `, ${point.rain.value} in of rain`
          : '';
        return (
          <div key={hour} className="flex items-start pl-1.5 pr-2" style={{ height: PIXELS_PER_HOUR }}>
            {/* The first row has no time label (it sits at the very top of the grid), so its
                weather is nudged down a touch instead of centered on a line. */}
            <div className={['flex w-full items-center', hourly ? '' : 'justify-end'].join(' ')} style={{ marginTop: i === 0 ? 2 : -6 }}>
              <span className="w-9 shrink-0 text-right text-[10px] font-medium leading-none text-gray-400 dark:text-gray-500">
                {i !== 0 ? formatHour(hour) : ''}
              </span>
              {point && info && (
                <span
                  className="ml-1.5 flex items-center gap-0.5 whitespace-nowrap text-[10px] leading-none text-gray-700 dark:text-gray-200"
                  title={`${formatHour(hour)}: ${info.label}, ${point.temp}°${rain}`}
                >
                  <span className="text-[11px]">{info.icon}</span>
                  <span className="font-semibold tabular-nums">{point.temp}°</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
