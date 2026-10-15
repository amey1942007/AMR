'use client';
import { Logo } from '@/components/nav/Logo';
import { useServices } from '@/components/providers/ServicesProvider';
import { LoginForm, LoginUnavailable } from './LoginForm';

export function LoginCard({ redirectTarget }: { redirectTarget: string }) {
  const { auth } = useServices();
  const available = auth.isAvailable();
  return (
    <div className="glass w-full max-w-[420px] rounded-[var(--radius-card)] p-10 max-md:p-6">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo height={28} />
        <h1 className="text-[length:var(--text-h3)] font-semibold text-white">Sign in</h1>
        <p className="text-[length:var(--text-small)] text-muted">Invite-only control panel access for the AMR team.</p>
      </div>
      {available ? <LoginForm redirectTarget={redirectTarget} /> : <LoginUnavailable />}
    </div>
  );
}
