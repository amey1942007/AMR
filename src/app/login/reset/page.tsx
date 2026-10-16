import type { Metadata } from 'next';
import { ResetRedirect } from './ResetRedirect';

export const metadata: Metadata = { title: 'Reset your password | AMR', robots: { index: false, follow: false } };

export default function Page() {
  return <ResetRedirect />;
}
