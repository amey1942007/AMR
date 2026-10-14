'use client';
import { createElement, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { asset } from '@/lib/asset';

type State = 'idle' | 'loading' | 'ready' | 'error';
type MV = HTMLElement & { cameraOrbit: string; getCameraOrbit?: () => { theta: number; phi: number; radius: number } };

/**
 * The only WebGL on subpages. Lazy: model-viewer (no R3F / three app bundle) is imported only when the viewer
 * scrolls near the viewport, never under reduced motion or without a model (poster only). Drag-orbit, no zoom;
 * ←/→ rotate 15°. Auto-rotate 8°/s, paused on hover/focus.
 */
export function RobotViewer({ model, name, poster }: { model?: string; name: string; poster?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>('idle');
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (!model || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setState('loading');
      // Self-hosted decoders (CSP connect-src 'self'; no gstatic/CDN requests). model-viewer reads this global config.
      (window as unknown as { ModelViewerElement?: object }).ModelViewerElement = { dracoDecoderLocation: asset('/draco/'), ktx2TranscoderLocation: asset('/basis/') };
      import('@google/model-viewer').then(() => setState('ready')).catch(() => setState('error'));
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [model]);
  const onKey = (e: KeyboardEvent) => {
    const el = e.currentTarget.querySelector('model-viewer') as MV | null;
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !el?.getCameraOrbit) return;
    e.preventDefault();
    const o = el.getCameraOrbit();
    const theta = o.theta + ((e.key === 'ArrowLeft' ? -15 : 15) * Math.PI) / 180;
    el.cameraOrbit = `${theta}rad ${o.phi}rad ${o.radius}m`;
  };
  const label = `3D model of ${name}, use arrow keys to rotate`;
  return (
    <div ref={box} className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-dark)] bg-[var(--bg-room)]" data-state={state}>
      {state !== 'ready' && (
        poster
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={asset(poster)} alt={`${name} (preview image)`} className="absolute inset-0 h-full w-full object-contain" />
          : <div role="img" aria-label={`${name}, schematic placeholder`} className="absolute inset-0 grid place-items-center">
              <svg aria-hidden viewBox="0 0 120 120" width={140} height={140} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth={1.5}><rect x={25} y={35} width={70} height={50} rx={10} /><circle cx={60} cy={30} r={10} /><circle cx={38} cy={90} r={8} /><circle cx={82} cy={90} r={8} /></svg>
            </div>
      )}
      {state === 'loading' && <span aria-hidden className="absolute inset-x-0 bottom-0 h-px animate-pulse bg-grad" />}
      {state === 'ready' && model && (
        <div tabIndex={0} role="group" aria-label={label} onKeyDown={onKey} onFocus={() => setHold(true)} onBlur={() => setHold(false)} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)} className="absolute inset-0">
          {createElement('model-viewer', {
            src: asset(model), alt: label, 'camera-controls': '', 'disable-zoom': '', 'disable-pan': '', 'interaction-prompt': 'none',
            ...(hold ? {} : { 'auto-rotate': '' }), 'auto-rotate-delay': '0', 'rotation-per-second': '8deg',
            style: { width: '100%', height: '100%', background: 'transparent' },
          })}
        </div>
      )}
    </div>
  );
}
