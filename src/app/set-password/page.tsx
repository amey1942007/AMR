import type { Metadata } from 'next';
import { SetPasswordPage } from '@/components/auth/SetPasswordPage';

export const metadata: Metadata = {
  title: 'Set password | AMR',
  robots: { index: false, follow: false },
  alternates: { canonical: '/set-password/' },
};

export default function Page() {
  return (
    <>
      <style>{'@view-transition { navigation: none; }'}</style>
      <SetPasswordPage />
    </>
  );
}
