'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { authInputClass, authLabelClass } from './AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      setError("Sign-up isn't configured yet (missing Supabase settings).");
      return;
    }
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
    const { data, error: signUpError } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    // With email confirmation turned on in Supabase there's no session yet —
    // the person has to click the link in their inbox first.
    if (!data.session) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  if (needsConfirmation) {
    return (
      <div className="text-center py-2">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
          <MailCheck size={22} />
        </span>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Check your email</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          We sent a confirmation link to <span className="font-medium">{email.trim()}</span>. Open it to finish
          creating your account, then{' '}
          <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">sign in</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className={authLabelClass}>Your name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={authInputClass}
          placeholder="e.g. Alex"
        />
      </div>
      <div>
        <label htmlFor="email" className={authLabelClass}>Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className={authLabelClass}>Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
      </div>
      <div>
        <label htmlFor="confirm" className={authLabelClass}>Confirm password</label>
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
        disabled={loading || !name.trim() || !email.trim() || !password || !confirm}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
