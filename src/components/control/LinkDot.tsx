'use client';

import type { LinkPhase } from '@/lib/telemetry/link-status';

/** Link state as a single color dot: green=live, yellow=connecting/idle, red=offline. */
export function LinkDot({ phase, label, lagMs }: { phase: LinkPhase; label: string; lagMs: number | null }) {
  const tone = phase === 'live' ? 'ok' : phase === 'offline' ? 'err' : 'warn';
  const title = lagMs != null ? `${label} · lag ${Math.round(lagMs)} ms` : label;
  return (
    <span
      className={`op-link-dot ${tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={title}
      title={title}
    >
      <span className="op-link-dot-core" aria-hidden />
      <span className="sr-only">{title}</span>
    </span>
  );
}
