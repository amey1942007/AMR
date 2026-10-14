'use client';
import { useRef } from 'react';
import { S } from '@/lib/scene-state';
import { useScene } from '@/lib/store';
import { useTick } from '@/components/journey/useTick';
import { useServices } from '@/components/providers/ServicesProvider';

/** ?debug=1 — p, tier, fps, adapter names. */
export function DebugHUD() {
  const ref = useRef<HTMLPreElement>(null);
  const { contact } = useServices();
  const frames = useRef({ n: 0, t: 0, fps: 0 });
  useTick((t) => {
    const f = frames.current;
    f.n++;
    if (t - f.t >= 0.5) { f.fps = Math.round(f.n / (t - f.t)); f.n = 0; f.t = t; }
    const s = useScene.getState();
    if (ref.current)
      ref.current.textContent = `p ${S.p.toFixed(3)}  uDrive ${S.uDrive.toFixed(3)}\ntier ${s.tier}  fps ${f.fps}  nav ${s.navDark ? 'dark' : 'light'}\nmap ${s.mapPct}%  robot ${s.robotSource}${s.renderPaused ? '  render paused' : ''}\ncontact ${contact.name}  content static  media static  map runtime`;
  });
  return <pre ref={ref} aria-hidden className="glass pointer-events-none fixed top-[calc(var(--nav-h)+8px)] left-2 rounded-lg p-2 font-mono text-[11px] leading-tight text-white" style={{ zIndex: 45 }} />;
}
