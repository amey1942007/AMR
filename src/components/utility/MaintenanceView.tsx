import { UtilityLayout } from './UtilityLayout';
import { EMAIL } from '@/lib/content';

function formatUntil(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(d);
}

/** login-spec §5. Rendered at /maintenance/ and, with NEXT_PUBLIC_MAINTENANCE=1, for every route (build-time switch). */
export function MaintenanceView({ until }: { until?: string }) {
  const t = formatUntil(until);
  return (
    <UtilityLayout effects={['rings', 'waves']} shortHide={false}>
      <div className="relative flex flex-col items-center text-center" style={{ ['--fx-period' as string]: '6s' }}>
        <div aria-hidden className="mb-10 flex flex-col items-center">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1 L14 14 L8 11 L2 14 Z" fill="#fff" /></svg>
          <span className="mt-1 block h-px w-12 bg-white/40" />
        </div>
        <p className="eyebrow text-muted">STATUS · DOCKED FOR MAINTENANCE</p>
        <h1 className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]">Back soon.</h1>
        <p className="mt-6 max-w-[48ch] text-white/80">
          We&apos;re updating the site. It&apos;ll be back shortly. You can still reach us at <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
        {t && <p className="mt-4 font-mono text-[length:var(--text-small)] text-muted">Expected back by {t} IST.</p>}
      </div>
    </UtilityLayout>
  );
}
