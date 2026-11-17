import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = { title: 'Sign in · Trip Planner' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  // Only ever redirect to a path on this site after signing in.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your trips."
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm
        next={safeNext}
        initialError={error === 'link' ? 'That link has expired or was already used. Please sign in or request a new one.' : undefined}
      />
    </AuthShell>
  );
}
