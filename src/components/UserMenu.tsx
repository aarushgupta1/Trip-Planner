'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { getEditorName, setEditorName } from '@/lib/editorName';

// Account button (the blue circle): shows who's signed in, lets you change the
// name shown on your edits ("last edited by ___"), and signs out. The edit
// name starts as the account name, so edits are attributed to the right
// person without any setup.
export default function UserMenu({ displayName, email }: { displayName: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fallback = displayName || email.split('@')[0];
    if (!getEditorName() && fallback) setEditorName(fallback);
  }, [displayName, email]);

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
        onClick={() => {
          if (!open) {
            setNameDraft(getEditorName() ?? displayName);
            setNameSaved(false);
          }
          setOpen((o) => !o);
        }}
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
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <label htmlFor="edit-name" className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              Name on your edits
            </label>
            <div className="flex gap-1.5">
              <input
                id="edit-name"
                type="text"
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNameSaved(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditorName(nameDraft);
                    setNameSaved(true);
                  }
                }}
                maxLength={40}
                placeholder={displayName || 'Your name'}
                className="min-w-0 flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  setEditorName(nameDraft);
                  setNameSaved(true);
                }}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                {nameSaved ? 'Saved' : 'Save'}
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">Shown as “last edited by …” on events and hotels you change.</p>
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
