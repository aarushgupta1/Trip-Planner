'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { authInputClass, authLabelClass } from './AuthShell';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      setError("Password reset isn't configured yet (missing Supabase settings).");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    // Same message whether or not the address has an account, so this can't
    // be used to find out who's registered.
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center py-2">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
          <MailCheck size={22} />
        </span>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Check your email</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          If an account exists for {email.trim()}, a reset link is on its way.
        </p>
      </div>
    );
  }

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
      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
