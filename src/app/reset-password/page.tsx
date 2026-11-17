import AuthShell from '@/components/auth/AuthShell';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata = { title: 'Choose a new password · Trip Planner' };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <ResetPasswordForm />
    </AuthShell>
  );
}
