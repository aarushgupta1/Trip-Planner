import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import JoinButton from '@/components/JoinButton';
import { previewInvite } from '@/app/trips/actions';

export const metadata = { title: 'Join trip · Trip Planner' };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewInvite(token);

  if (!preview) {
    return (
      <AuthShell
        title="Invite link not valid"
        subtitle="It may have been turned off or replaced. Ask the trip owner for a new link."
        footer={<Link href="/" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Go to my trips</Link>}
      >
        <span />
      </AuthShell>
    );
  }

  if (preview.already_member) redirect('/');

  return (
    <AuthShell title={`Join “${preview.trip_name}”`} subtitle={`${preview.owner_name} invited you to plan this trip together.`}>
      <JoinButton token={token} />
    </AuthShell>
  );
}
