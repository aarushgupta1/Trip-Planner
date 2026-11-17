'use client';

import { useEffect, useState } from 'react';
import { getNowInZone, ZonedNow } from './tripTime';

// Starts `null` (rather than computing during the initial render) so the
// server-rendered HTML and the client's first render always match — the
// "today" highlight and current-time line only appear once mounted
// client-side, then refresh every minute.
export function useNowInZone(timeZone: string): ZonedNow | null {
  const [now, setNow] = useState<ZonedNow | null>(null);

  useEffect(() => {
    setNow(getNowInZone(timeZone));
    const id = setInterval(() => setNow(getNowInZone(timeZone)), 60_000);
    return () => clearInterval(id);
  }, [timeZone]);

  return now;
}
