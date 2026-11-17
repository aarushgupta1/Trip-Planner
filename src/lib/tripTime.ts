// Plain (non-"use client") time-zone helpers — safe to import from client
// components and from server-only code (server actions, API routes).

export interface ZonedNow {
  date: string; // YYYY-MM-DD, calendar date in that zone
  minutes: number; // minutes since midnight in that zone
}

// "Right now" as a wall-clock date + time in the given IANA zone. The
// calendar grid always shows destination wall-clock time, so "today", the
// current-time line and event reminders all need the destination's clock —
// not the server's or the browser's.
export function getNowInZone(timeZone: string, at: Date = new Date()): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = Number(get('hour')) % 24; // Intl can render midnight as "24" with hour12: false
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hour * 60 + Number(get('minute')),
  };
}

// Offset of a zone from UTC, in minutes, at a particular instant (so
// daylight-saving is accounted for), e.g. Europe/Vienna in August → +120.
export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const name =
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!m) return 0; // plain "GMT" = UTC
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    return 0;
  }
}

// How many minutes the home zone is ahead of (+) or behind (−) the trip's
// local zone on the given date — what a "home time" label is shifted by.
export function homeShiftMinutes(localTimeZone: string, homeTimeZone: string, refDate: string): number {
  const at = new Date(refDate + 'T12:00:00Z');
  return zoneOffsetMinutes(homeTimeZone, at) - zoneOffsetMinutes(localTimeZone, at);
}

// "EDT", "CEST", "GMT+9" … — a short label for a zone on a given date.
export function zoneAbbreviation(timeZone: string, refDate: string): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
        .formatToParts(new Date(refDate + 'T12:00:00Z'))
        .find((p) => p.type === 'timeZoneName')?.value ?? timeZone
    );
  } catch {
    return timeZone;
  }
}
