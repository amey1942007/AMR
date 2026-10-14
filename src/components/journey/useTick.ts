'use client';
import { useEffect, useRef } from 'react';
import { addTick } from '@/lib/ticker';
/** Runs fn every animation frame. DOM writes via refs only — no React state per frame. */
export function useTick(fn: (time: number, dt: number) => void, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => (enabled ? addTick((t, dt) => ref.current(t, dt)) : undefined), [enabled]);
}
