'use client';
import { asset } from '@/lib/asset';
import { AuthGuard } from './AuthGuard';
import { useAuth } from '@/lib/useAuth';
import { PillButton } from '@/components/nav/PillButton';
import { UtilityLayout } from '@/components/utility/UtilityLayout';

function Inner() {
  const { session, signOut } = useAuth();
  return (
    <div className="glass w-full rounded-[var(--radius-card)] p-10 text-center max-md:p-6">
      <p className="eyebrow text-muted">CONTROL PANEL</p>
      <h1 className="mt-4 text-[length:var(--text-h3)] font-semibold text-white">Control panel: coming soon</h1>
      {session?.email && <p className="mt-3 text-[length:var(--text-small)] text-muted">Signed in as {session.email}</p>}
      <div className="mt-8 flex justify-center">
        <PillButton kind="ghost" onClick={async () => { await signOut(); window.location.replace(asset('/login/')); }}>Sign out</PillButton>
      </div>
    </div>
  );
}

/** login-spec §1.1 stub. The client guard is UX only: real protection lives on the control-panel backend. */
export function ControlStub() {
  return (
    <UtilityLayout effects={['waves']}>
      <AuthGuard><Inner /></AuthGuard>
    </UtilityLayout>
  );
}
