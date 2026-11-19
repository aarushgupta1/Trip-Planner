'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, LogOut, Pencil, User } from 'lucide-react';
import { getEditorName, setEditorName } from '@/lib/editorName';

// Account button (the blue circle): shows who's signed in, lets you change the
// name shown on your edits ("last edited by ___"), and signs out. The edit
// name starts as the account name, so edits are attributed to the right
// person without any setup.
export default function UserMenu({ displayName, email }: { displayName: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [shownName, setShownName] = useState(displayName);
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

  const saveName = () => {
    const n = nameDraft.trim();
    if (n) {
      setEditorName(n);
      setShownName(n);
    }
    setEditing(false);
  };

  const initial = (displayName || email || '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          if (!open) {
            setEditing(false);
            setShownName(getEditorName() || displayName);
          }
          setOpen((o) => !o);
        }}
        title={displayName || email}
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-300 text-red-700 text-sm font-bold hover:bg-blue-400 ring-1 ring-blue-400/60 dark:bg-blue-900 dark:text-red-400 dark:ring-blue-700 dark:hover:bg-blue-800 transition-colors"
      >
        {initial || <User size={14} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1.5">
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800">
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  aria-label="Your name"
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  maxLength={40}
                  placeholder={displayName || 'Your name'}
                  className="min-w-0 flex-1 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={saveName} aria-label="Save name" className="shrink-0 rounded-md p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800">
                  <Check size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="min-w-0 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{shownName || 'Add your name'}</p>
                <button
                  onClick={() => {
                    setNameDraft(shownName);
                    setEditing(true);
                  }}
                  aria-label="Edit your name"
                  title="Edit your name"
                  className="shrink-0 rounded-md p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <p className={['text-xs text-gray-400 dark:text-gray-500 truncate', editing ? 'mt-2.5' : 'mt-0.5'].join(' ')}>{email}</p>
            {editing && <p className="mt-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">Shown as “last edited by …” on events and lodgings you change.</p>}
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
