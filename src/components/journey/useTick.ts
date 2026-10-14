'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
/** Runs fn on GSAP's ticker (shared rAF with Lenis). DOM writes via refs only — no React state per frame. */
export function useTick(fn: (time: number, dt: number) => void, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    if (!enabled) return;
    const cb = (t: number, dt: number) => ref.current(t, dt / 1000);
    gsap.ticker.add(cb);
    return () => gsap.ticker.remove(cb);
  }, [enabled]);
}
