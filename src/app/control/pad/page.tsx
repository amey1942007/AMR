import type { Metadata } from 'next';
import { PadStub } from '@/components/auth/PadStub';

export const metadata: Metadata = {
  title: 'Controller | AMR',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <style>{'@view-transition { navigation: none; }'}</style>
      <PadStub />
    </>
  );
}
