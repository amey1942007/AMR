import { UtilityLayout } from './UtilityLayout';
import { PillButton } from '@/components/nav/PillButton';
import Link from '@/components/nav/AppLink';

/** login-spec §2 "Robot lost". Static HTML + CSS. Effects capped at 2 (sweep + rings; WaveLines dropped per the §0 rule). */
export function NotFoundView() {
  return (
    <UtilityLayout effects={['sweep', 'rings']} showFooter shortHide={false}>
      <div className="flex flex-col items-center text-center">
        <div aria-hidden className="relative mb-10 grid size-4 place-items-center">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1 L14 14 L8 11 L2 14 Z" fill="#fff" /></svg>
        </div>
        <div aria-hidden className="glass mb-10 w-[240px] rounded-[12px] p-3 text-left max-md:w-full max-md:max-w-[320px]">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[0.6rem] text-white/80">OCCUPANCY MAP · 0%</span>
            <span className="fx-chip-pulse eyebrow rounded-[4px] border border-danger/60 px-1.5 py-0.5 text-[0.6rem] text-danger">NO MAP</span>
          </div>
          <div className="mt-2 h-[84px]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
        </div>
        <p className="eyebrow text-muted">ERROR 404 · LOCALISATION FAILED</p>
        <h1 className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]">Robot lost.</h1>
        <p className="mt-6 max-w-[48ch] text-white/80">We scanned everywhere, but this page isn&apos;t on our map. It may have moved, or the link might be wrong.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 max-md:w-full max-md:flex-col">
          <PillButton kind="filled" href="/" icon="arrow">Back to home</PillButton>
          <PillButton kind="ghost" href="/robots/">See the robots</PillButton>
        </div>
        <Link href="/contact/?topic=Other" className="mt-6 text-[length:var(--text-small)] text-white/70 underline hover:text-white">Report a broken link</Link>
      </div>
    </UtilityLayout>
  );
}
