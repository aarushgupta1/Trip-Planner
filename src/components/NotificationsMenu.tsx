'use client';

import { useEffect, useRef, useState } from 'react';
import { NotificationPermissionState } from '@/lib/pushNotifications';
import { Bell, BellRing, BellOff } from 'lucide-react';

const SEEN_KEY = 'vienna-more-menu-seen';

interface NotificationsMenuProps {
  notifyPermission: NotificationPermissionState;
  notifySubscribed: boolean;
  onEnableNotifications: () => void;
  onDisableNotifications: () => void;
}

// The event-alerts bell in the toolbar. The icon shows the current state at a
// glance (outline = not set up, ringing = on, slashed = off or blocked), and
// clicking it opens a small panel with the one action that applies.
export default function NotificationsMenu({
  notifyPermission,
  notifySubscribed,
  onEnableNotifications,
  onDisableNotifications,
}: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  // Whether this device has ever opened the panel — once it has, the "check
  // this out" dot shouldn't keep coming back.
  const [seen, setSeen] = useState(true); // default true until checked, avoids a flash of the dot
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN_KEY) === '1');
    } catch {
      // If storage is unavailable, just leave it as seen — not worth nagging.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markSeen = () => {
    setSeen(true);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Best-effort — worst case the dot just comes back next visit.
    }
  };

  const on = notifyPermission === 'granted' && notifySubscribed;
  const hasBadge = !seen && notifyPermission === 'default';
  const Icon = on ? BellRing : notifyPermission === 'denied' || (notifyPermission === 'granted' && !notifySubscribed) ? BellOff : Bell;
  const label = on ? 'Event alerts are on' : notifyPermission === 'denied' ? 'Event alerts are blocked' : 'Event alerts';

  const row = 'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => { setOpen((o) => !o); markSeen(); }}
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

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1.5">
          {/* The panel stays open after an action so the "on"/"off" change is
              visible right away. */}
          {notifyPermission === 'default' && (
            <button onClick={onEnableNotifications} className={row}>
              <Bell size={14} className="text-gray-400 dark:text-gray-500" />
              Get event alerts
            </button>
          )}
          {notifyPermission === 'granted' && notifySubscribed && (
            <button
              onClick={onDisableNotifications}
              title="You'll get a notification 30 minutes before each event starts, on this device — even if this app isn't open. Click to turn off."
              className={row}
            >
              <BellRing size={14} className="text-blue-500 dark:text-blue-400" />
              Alerts on
              <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">Turn off</span>
            </button>
          )}
          {notifyPermission === 'granted' && !notifySubscribed && (
            <button onClick={onEnableNotifications} className={row}>
              <BellOff size={14} className="text-gray-400 dark:text-gray-500" />
              Alerts off
              <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">Turn on</span>
            </button>
          )}
          {notifyPermission === 'denied' && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-400 dark:text-gray-500"
              title="Notifications are blocked for this site — enable them in your browser's site settings to get 30-minute event alerts"
            >
              <BellOff size={14} />
              Alerts blocked
            </div>
          )}
          <p className="px-3 pb-1.5 pt-0.5 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
            A notification 30 minutes before each event starts, on this device.
          </p>
        </div>
      )}
    </div>
  );
}
