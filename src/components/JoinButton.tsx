'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { joinTrip } from '@/app/trips/actions';

export default function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const join = () =>
    startTransition(async () => {
      setError(null);
      const result = await joinTrip(token);
      if ('error' in result) setError(result.error);
      else router.replace(`/trips/${result.id}`);
    });

  return (
    <>
      <button
        onClick={join}
        disabled={isPending}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {isPending ? 'Joining…' : 'Join trip'}
      </button>
      {error && <p className="mt-3 text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}
    </>
  );
}
