import type { Metadata } from 'next';
import { UtilityLayout } from '@/components/utility/UtilityLayout';
import { PillButton } from '@/components/nav/PillButton';
import { Logo } from '@/components/nav/Logo';
import { EMAIL } from '@/lib/content';

export const metadata: Metadata = { title: 'Reset your password | AMR Control panel', robots: { index: false, follow: false } };

/** login-spec §1.5 stub: no email field, no real flow yet. */
export default function Page() {
  return (
    <UtilityLayout effects={['rings', 'waves']}>
      <div className="flex justify-center">
        <div className="glass w-full max-w-[420px] rounded-[var(--radius-card)] p-10 text-center max-md:p-6">
          <div className="mb-6 flex justify-center"><Logo height={28} /></div>
          <h1 className="text-[length:var(--text-h3)] font-semibold text-white">Reset your password</h1>
          <p className="mt-4 text-[length:var(--text-small)] text-white/80">
            Password reset isn&apos;t self-service yet. Email {EMAIL} from the address you use to sign in, and we&apos;ll help.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3">
            <PillButton kind="filled" href={`mailto:${EMAIL}?subject=${encodeURIComponent('Control panel password reset')}`} icon="arrow">Email {EMAIL}</PillButton>
            <PillButton kind="ghost" href="/login/">Back to sign in</PillButton>
          </div>
        </div>
      </div>
    </UtilityLayout>
  );
}
