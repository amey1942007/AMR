'use client';
import { useEffect } from 'react';
import { setLenis } from '@/lib/lenis-ref';
import { loadGsap, loadLenis } from '@/lib/motion';
import { addTick } from '@/lib/ticker';

/** Lenis smooth scroll (lazy) synced to ScrollTrigger (brief §9). Native scroll semantics stay (keyboard, zoom). */
export function SmoothScroll({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true, cleanup = () => {};
    Promise.all([loadLenis(), loadGsap()]).then(([Lenis, { ScrollTrigger }]) => {
      if (!alive) return;
      const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
      setLenis(lenis);
      lenis.on('scroll', ScrollTrigger.update);
      const off = addTick((t) => lenis.raf(t * 1000));
      cleanup = () => { off(); lenis.destroy(); setLenis(null); };
    });
    return () => { alive = false; cleanup(); };
  }, [enabled]);
  return null;
}
