import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import SignupForm from '@/components/auth/SignupForm';

export const metadata = { title: 'Create account · Trip Planner' };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Plan a trip to anywhere — your itinerary is private to you."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
