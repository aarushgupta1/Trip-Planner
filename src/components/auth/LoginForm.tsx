'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { authInputClass, authLabelClass } from './AuthShell';

export default function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      setError("Sign-in isn't configured yet (missing Supabase settings).");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes('email not confirmed')
          ? 'Please confirm your email first — check your inbox for the link.'
          : 'Incorrect email or password.'
      );
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className={authLabelClass}>Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Password
          </label>
          <Link href="/forgot-password" className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading || !email.trim() || !password}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
