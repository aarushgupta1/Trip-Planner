import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import SignupForm from '@/components/auth/SignupForm';
import { safeNext, withNext } from '@/lib/safeNext';

export const metadata = { title: 'Create account · Trip Planner' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const target = safeNext((await searchParams).next);
  return (
    <AuthShell
      title="Create your account"
      subtitle="Plan a trip to anywhere — your itinerary is private to you and anyone you invite."
      footer={
        <>
          Already have an account?{' '}
          <Link href={withNext('/login', target)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm next={target} />
    </AuthShell>
  );
}
