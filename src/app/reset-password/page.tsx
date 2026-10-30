import ResetPasswordForm from '@/components/ResetPasswordForm';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
