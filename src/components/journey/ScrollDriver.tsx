'use client';
import { useEffect } from 'react';
import { createJourney } from '@/lib/timeline';
import { useScene } from '@/lib/store';

/** Builds the master timeline + single ScrollTrigger. Under reduced motion, nav theme follows plain scroll. */
export function ScrollDriver({ reducedMotion }: { reducedMotion: boolean }) {
  useEffect(() => {
    if (!reducedMotion) return createJourney();
    const on = () => useScene.setState({ navDark: window.scrollY > window.innerHeight * 0.8 });
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, [reducedMotion]);
  useEffect(() => () => useScene.setState({ navDark: false }), []);
  return null;
}
