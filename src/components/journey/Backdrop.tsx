'use client';
import { useRef } from 'react';
import { S } from '@/lib/scene-state';
import { useTick } from './useTick';
import { lerp } from '@/lib/monotone';

const HERO = [0xf2, 0xf1, 0xf5], ROOM = [0x0a, 0x0a, 0x10];
/** R3: fixed DOM colour layer under the always-alpha canvas. --bg-hero → --bg-room over bgMix. */
export function Backdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(-1);
  useTick(() => {
    if (!ref.current || S.bgMix === last.current) return;
    last.current = S.bgMix;
    const c = HERO.map((h, i) => Math.round(lerp(h, ROOM[i], S.bgMix)));
    ref.current.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
  });
  return <div ref={ref} aria-hidden className="fixed inset-0" style={{ zIndex: 0, backgroundColor: 'var(--bg-hero)' }} />;
}
