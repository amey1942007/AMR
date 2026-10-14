import type { Metadata } from 'next';
import { LoginPage } from '@/components/auth/LoginPage';

export const metadata: Metadata = {
  title: 'Sign in | AMR Control panel',
  robots: { index: false, follow: false },
  alternates: { canonical: '/login/' },
};
export default function Page() {
  return <LoginPage />;
}
