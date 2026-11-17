'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2, UserMinus, X } from 'lucide-react';
import { createInvite, removeMember, revokeInvite, type TripPerson } from '@/app/trips/actions';

export default function ShareTripModal({
  tripId,
  isOwner,
  currentUserId,
  people,
  initialToken,
  onClose,
}: {
  tripId: string;
  isOwner: boolean;
  currentUserId: string;
  people: TripPerson[];
  initialToken: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/join/${token}` : '';

  const generate = () =>
    startTransition(async () => {
      setError(null);
      const result = await createInvite(tripId);
      if ('error' in result) setError(result.error);
      else setToken(result.token);
    });

  const stop = () =>
    startTransition(async () => {
      setError(null);
      const result = await revokeInvite(tripId);
      if ('error' in result) setError(result.error);
      else setToken(null);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copy failed — select the link and copy it manually.');
    }
  };

  const remove = (userId: string) =>
    startTransition(async () => {
      setError(null);
      const result = await removeMember(tripId, userId);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      if (userId === currentUserId) router.push('/');
      else router.refresh();
    });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{isOwner ? 'Share this trip' : 'People on this trip'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {isOwner && (
          <section className="mb-5">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Anyone with this link who signs in can view and edit events, hotels and notes. Only you can change trip settings or delete it.
            </p>
            {token ? (
              <>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs bg-gray-50 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    onClick={copy}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="mt-2 flex gap-3 text-xs">
                  <button disabled={isPending} onClick={generate} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline disabled:opacity-50">
                    New link (old one stops working)
                  </button>
                  <button disabled={isPending} onClick={stop} className="text-red-500 dark:text-red-400 font-semibold hover:underline disabled:opacity-50">
                    Turn off link
                  </button>
                </div>
              </>
            ) : (
              <button
                disabled={isPending}
                onClick={generate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                <Link2 size={14} />
                Create invite link
              </button>
            )}
          </section>
        )}

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">On this trip</h3>
          <ul className="space-y-1">
            {people.map((p) => {
              const isYou = p.user_id === currentUserId;
              const canRemove = !p.is_owner && (isOwner || isYou);
              return (
                <li key={p.user_id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span className="text-sm text-gray-800 dark:text-gray-100 truncate">
                    {p.display_name}
                    {isYou && <span className="text-gray-400"> (you)</span>}
                    {p.is_owner && <span className="ml-1.5 text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-400">Owner</span>}
                  </span>
                  {canRemove && (
                    <button
                      disabled={isPending}
                      onClick={() => remove(p.user_id)}
                      title={isYou ? 'Leave trip' : 'Remove from trip'}
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                    >
                      <UserMinus size={14} />
                      {isYou ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {error && <p className="mt-3 text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}
      </div>
    </div>
  );
}
