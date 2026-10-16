import type { Metadata } from 'next';
import { SignInPage } from '@/components/auth/SignInPage';

export const metadata: Metadata = {
  title: 'Sign in | AMR',
  robots: { index: false, follow: false },
  alternates: { canonical: '/login/' },
};

/** Old path. Same email sign-in as /sign-in. */
export default function Page() {
  return <SignInPage />;
}
