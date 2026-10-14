'use client';
import { useEffect } from 'react';
import { useScene } from '@/lib/store';

/** Builds the master timeline + single ScrollTrigger (lazy chunk). Under reduced motion, nav theme follows plain scroll. */
export function ScrollDriver({ reducedMotion }: { reducedMotion: boolean }) {
  useEffect(() => {
    if (reducedMotion) {
      const on = () => useScene.setState({ navDark: window.scrollY > window.innerHeight * 0.8 });
      on();
      addEventListener('scroll', on, { passive: true });
      return () => removeEventListener('scroll', on);
    }
    let alive = true, kill = () => {};
    import('@/lib/timeline').then((m) => { if (alive) kill = m.createJourney(); });
    return () => { alive = false; kill(); };
  }, [reducedMotion]);
  useEffect(() => () => useScene.setState({ navDark: false }), []);
  return null;
}
