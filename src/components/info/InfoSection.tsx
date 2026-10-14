'use client';
import { useEffect, useRef } from 'react';
import { loadGsap } from '@/lib/motion';
import type { ReactNode } from 'react';

/** #info: transparent → --bg at 40%; blocks reveal y40→0 700ms power3.out stagger 80 (opacity-only under RM). */
/** Client wrapper only (reveal logic). The content is server-rendered (InfoContent) and passed as children → no JS cost. */
export function InfoSection({ reducedMotion = false, children }: { reducedMotion?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;
    const blocks = el.querySelectorAll<HTMLElement>('.reveal');
    let alive = true, cleanup = () => {};
    // Initial hidden state is applied by JS only (no-JS: visible).
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (!alive) return;
      const pending = Array.from(blocks).filter((b) => b.getBoundingClientRect().top > innerHeight * 0.8);
      gsap.set(pending, { opacity: 0, y: 40 });
      const triggers = ScrollTrigger.batch(pending, {
        start: 'top 80%',
        once: true,
        onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, overwrite: true }),
      });
      cleanup = () => { triggers.forEach((t) => t.kill()); gsap.set(blocks, { clearProps: 'all' }); };
    });
    return () => { alive = false; cleanup(); };
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
