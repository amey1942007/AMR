'use client';
import { useEffect } from 'react';
import { setLenis } from '@/lib/lenis-ref';
import { loadLenis } from '@/lib/motion';
import { addTick } from '@/lib/ticker';

/** Lenis smooth scroll (lazy) on the shared ticker (brief §9). Native scroll semantics stay (keyboard, zoom). */
export function SmoothScroll({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true, cleanup = () => {};
    loadLenis().then((Lenis) => {
      if (!alive) return;
      const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
      setLenis(lenis);
      // One clock (review #8): Lenis runs on the same shared ticker as the scroll timeline and the canvas
      // overlays, with raw timestamps (no lag smoothing), so scroll never jumps after a long frame.
      const off = addTick((t) => lenis.raf(t * 1000));
      cleanup = () => { off(); lenis.destroy(); setLenis(null); };
    });
    return () => { alive = false; cleanup(); };
  }, [enabled]);
  return null;
}
