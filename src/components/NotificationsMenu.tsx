'use client';

import { useEffect, useRef, useState } from 'react';
import { NotificationPermissionState } from '@/lib/pushNotifications';
import { Bell, BellRing, BellOff } from 'lucide-react';

const SEEN_KEY = 'vienna-more-menu-seen';
const TOAST_MS = 3500;

interface NotificationsMenuProps {
  notifyPermission: NotificationPermissionState;
  notifySubscribed: boolean;
  onEnableNotifications: () => Promise<boolean>;
  onDisableNotifications: () => Promise<void>;
}

// The event-alerts bell in the toolbar. One click turns alerts on and a small
// note appears for a few seconds saying when you'll be notified; clicking
// again turns them off. The icon shows the current state at a glance
// (outline = not set up, ringing = on, slashed = off or blocked).
export default function NotificationsMenu({
  notifyPermission,
  notifySubscribed,
  onEnableNotifications,
  onDisableNotifications,
}: NotificationsMenuProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Whether this device has ever clicked the bell — once it has, the "check
  // this out" dot shouldn't keep coming back.
  const [seen, setSeen] = useState(true); // default true until checked, avoids a flash of the dot
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN_KEY) === '1');
    } catch {
      // If storage is unavailable, just leave it as seen — not worth nagging.
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flash = (text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  };

  const handleClick = async () => {
    if (busy) return;
    setSeen(true);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Best-effort — worst case the dot just comes back next visit.
    }

    if (notifyPermission === 'unsupported') {
      flash("This browser doesn't support event alerts.");
      return;
    }
    if (notifyPermission === 'denied') {
      flash('Alerts are blocked for this site. Allow notifications in your browser settings to turn them on.');
      return;
    }

    setBusy(true);
    try {
      if (on) {
        await onDisableNotifications();
        flash('Alerts off.');
      } else {
        const ok = await onEnableNotifications();
        flash(ok ? "Alerts on. You'll be notified 30 minutes before each event." : "Couldn't turn on alerts. Check your browser's notification settings.");
      }
    } finally {
      setBusy(false);
    }
  };

  const on = notifyPermission === 'granted' && notifySubscribed;
  const hasBadge = !seen && notifyPermission === 'default';
  const Icon = on ? BellRing : notifyPermission === 'denied' || (notifyPermission === 'granted' && !notifySubscribed) ? BellOff : Bell;
  const label = on
    ? 'Event alerts are on (30 minutes before each event). Click to turn off.'
    : notifyPermission === 'denied'
      ? 'Event alerts are blocked in your browser settings'
      : 'Turn on event alerts';

  return (
    <div className="relative shrink-0">
      <button
        onClick={handleClick}
        disabled={busy}
        className={[
          'relative flex items-center px-2.5 py-1 rounded-lg border transition-colors',
          on
            ? 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
        ].join(' ')}
        title={label}
        aria-label={label}
      >
        <Icon size={15} />
        {hasBadge && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />}
      </button>

      {message && (
        <div
          role="status"
          className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-snug text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          {message}
        </div>
      )}
    </div>
  );
}
