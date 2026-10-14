import type { Metadata } from 'next';
import { ControlStub } from '@/components/auth/ControlStub';
export const metadata: Metadata = { title: 'Control panel | AMR', robots: { index: false, follow: false } };
export default function Page() {
  // Review login #6: the unsigned guard redirects immediately with location.replace(); a cross-document view
  // transition still running into /control then aborts ("Transition was aborted because of invalid state").
  // Opting this page out of navigation view transitions removes that race.
  return (
    <>
      <style>{'@view-transition { navigation: none; }'}</style>
      <ControlStub />
    </>
  );
}
