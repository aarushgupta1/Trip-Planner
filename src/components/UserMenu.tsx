'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { getEditorName, setEditorName } from '@/lib/editorName';

// Account button: shows who's signed in and signs out. Also seeds the
// "last edited by ___" name from the account so edits are attributed to the
// right person without any extra setup.
export default function UserMenu({ displayName, email }: { displayName: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getEditorName() && displayName) setEditorName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Don't leave this person's trips sitting in the offline cache or
      // their name attached to the next person's edits on a shared device.
      setEditorName('');
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await fetch('/auth/signout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };

  const initial = (displayName || email || '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={displayName || email}
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
      >
        {initial || <User size={14} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5">
          <div className="px-3.5 py-2 border-b border-gray-100 dark:border-gray-800">
            {displayName && <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</p>}
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{email}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <LogOut size={14} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
