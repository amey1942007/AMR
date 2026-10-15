'use client';
import dynamic from 'next/dynamic';
import { AuthGuard } from './AuthGuard';
import { SignalLoader } from '@/components/utility/SignalLoader';

const ControlPanel = dynamic(
  () => import('@/components/control/ControlPanel').then((m) => m.ControlPanel),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[40vh] place-items-center">
        <SignalLoader />
      </div>
    ),
  },
);

/** /control entry — AuthGuard + lazy live panel (keeps initial JS under shell+6 KB). */
export function ControlStub() {
  return (
    <AuthGuard>
      <ControlPanel />
    </AuthGuard>
  );
}
