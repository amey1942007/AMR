'use client';
import { useEffect, useState } from 'react';
import '@/components/effects/effects.css';

/**
 * login-spec §4: 32 px mini PulseRings (2 rings) + mono LOADING. Appears only after `delay` (300 ms) to avoid flashes;
 * once shown it stays at least `minMs` (400 ms) even if `active` turns false.
 */
export function SignalLoader({ active = true, delay = 300, minMs = 400, label = 'LOADING', onHidden }: { active?: boolean; delay?: number; minMs?: number; label?: string; onHidden?: () => void }) {
  const [shown, setShown] = useState(false);
  const [shownAt, setShownAt] = useState(0);
  useEffect(() => {
    if (active && !shown) {
      const id = window.setTimeout(() => { setShown(true); setShownAt(performance.now()); }, delay);
      return () => clearTimeout(id);
    }
    if (!active && shown) {
      const left = Math.max(0, minMs - (performance.now() - shownAt));
      const id = window.setTimeout(() => { setShown(false); onHidden?.(); }, left);
      return () => clearTimeout(id);
    }
    if (!active && !shown) onHidden?.();
  }, [active, shown, shownAt, delay, minMs, onHidden]);
  if (!shown) return null;
  return (
    <span role="status" className="signal-loader inline-flex items-center gap-2 text-white">
      <span className="relative inline-block size-8" aria-hidden>
        <svg className="fx-rings absolute inset-0 h-full w-full" viewBox="0 0 32 32" style={{ ['--fx-period' as string]: '1.6s' }}>
          <circle cx="16" cy="16" r="15" fill="none" stroke="#E81CB0" strokeWidth="1" />
          <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
        </svg>
      </span>
      <span aria-hidden className="eyebrow">{label}</span>
      <span className="sr-only">Loading…</span>
    </span>
  );
}
