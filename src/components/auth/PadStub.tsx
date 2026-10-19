'use client';

import dynamic from 'next/dynamic';
import { AuthGuard } from './AuthGuard';
import { SignalLoader } from '@/components/utility/SignalLoader';

const Pad = dynamic(
  () => import('@/components/control/PadPage').then((m) => m.PadPage),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[40vh] place-items-center">
        <SignalLoader />
      </div>
    ),
  },
);

/** /control/pad — full-window Xbox controller for mobile / complete control. */
export function PadStub() {
  return (
    <AuthGuard>
      <Pad />
    </AuthGuard>
  );
}
