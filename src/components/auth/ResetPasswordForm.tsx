'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { authInputClass, authLabelClass } from './AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className={authLabelClass}>New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
      </div>
      <div>
        <label htmlFor="confirm" className={authLabelClass}>Confirm new password</label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={authInputClass}
        />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {loading ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}
