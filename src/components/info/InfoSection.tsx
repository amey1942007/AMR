'use client';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { onReached } from '@/lib/reveal';

/** #info: transparent → --bg at 40%; blocks reveal y40→0 700ms power3.out stagger 80 (opacity-only under RM). */
/** Client wrapper only (reveal logic). The content is server-rendered (InfoContent) and passed as children → no JS cost. */
export function InfoSection({ reducedMotion = false, children }: { reducedMotion?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;
    const blocks = el.querySelectorAll<HTMLElement>('.reveal');
    // Initial hidden state is applied by JS only (no-JS: visible). CSS transition does the tween (no GSAP).
    const pending = Array.from(blocks).filter((b) => b.getBoundingClientRect().top > innerHeight * 0.8);
    pending.forEach((b) => b.classList.add('reveal-pending'));
    // Reveal state derives from the current position (also after End / anchor jumps), see lib/reveal.
    const stop = onReached(pending, 0.8, (hit) => hit.forEach((b, i) => { b.style.transitionDelay = `${i * 80}ms`; b.classList.remove('reveal-pending'); }));
    return () => { stop(); blocks.forEach((b) => { b.classList.remove('reveal-pending'); b.style.transitionDelay = ''; }); };
  }, [reducedMotion]);

  return (
    <section
      ref={ref}
      id="info"
      aria-labelledby="info-title"
      tabIndex={-1}
      className="relative text-white outline-none"
      style={{ zIndex: 20, background: 'linear-gradient(to bottom, transparent 0, var(--bg) 40%)' }}
    >
      {children}
    </section>
  );
}
