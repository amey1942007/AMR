'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { MapFrame } from '@/lib/telemetry/protocol';
import type { NormState } from '@/lib/telemetry/normalize';
import { canvasToWorld, drawLive, zoomScale } from '@/lib/telemetry/draw-live';
import { STALE_VEIL_MS } from '@/lib/telemetry/protocol';

export function LiveCanvas({
  state,
  map,
  scale,
  onScale,
  canEdit,
  mode,
  showSlam,
  lastAt,
  onNav,
  onBlacklist,
}: {
  state: NormState | null;
  map: MapFrame | null;
  scale: number;
  onScale: (n: number) => void;
  canEdit: boolean;
  mode: 'none' | 'nav' | 'nogo';
  showSlam: boolean;
  lastAt: number | null;
  onNav: (x: number, y: number) => void;
  onBlacklist: (x: number, y: number, radius: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slamRef = useRef<HTMLCanvasElement | null>(null);
  const trail = useRef<[number, number][]>([]);
  const drag = useRef<[number, number, number] | null>(null);
  const [dragTick, setDragTick] = useState(0);
  const pose = state?.pose ?? null;

  useEffect(() => {
    if (!pose) return;
    const last = trail.current[trail.current.length - 1];
    if (!last || Math.hypot(pose[0] - last[0], pose[1] - last[1]) > 0.02) {
      const point: [number, number] = [pose[0], pose[1]];
      trail.current = [...trail.current, point].slice(-600);
    }
  }, [pose]);

  useEffect(() => {
    if (!showSlam || !map?.data) { slamRef.current = null; return; }
    let dead = false;
    void decodeSlam(map).then((c) => { if (!dead) slamRef.current = c; });
    return () => { dead = true; };
  }, [showSlam, map]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const cssW = cv.clientWidth || 900;
      const cssH = cssW / (900 / 620);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const stale = lastAt != null && Date.now() - lastAt > STALE_VEIL_MS;
      drawLive(ctx, {
        state, map, trail: trail.current, scale, stale,
        slam: showSlam ? slamRef.current : null, drag: drag.current, width: cssW, height: cssH, dpr,
      });
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state, map, scale, showSlam, lastAt, dragTick]);

  function worldAt(e: PointerEvent<HTMLCanvasElement>) {
    const cv = ref.current;
    if (!cv || !state?.pose) return null;
    const rect = cv.getBoundingClientRect();
    return canvasToWorld(e.clientX, e.clientY, rect, rect.width, rect.height, state.pose, scale);
  }

  return (
    <canvas
      ref={ref}
      className="cv"
      role="img"
      aria-label="Live view of the robot in the odometry frame"
      style={{ cursor: canEdit && mode !== 'none' ? 'crosshair' : 'default' }}
      onWheel={(e) => { e.preventDefault(); onScale(zoomScale(scale, e.deltaY)); }}
      onPointerDown={(e) => {
        if (!canEdit || !state?.pose) return;
        const w = worldAt(e);
        if (!w) return;
        if (mode === 'nav') onNav(w[0], w[1]);
        if (mode === 'nogo') { drag.current = [w[0], w[1], 0]; setDragTick((n) => n + 1); (e.target as Element).setPointerCapture(e.pointerId); }
      }}
      onPointerMove={(e) => {
        if (!drag.current || mode !== 'nogo') return;
        const w = worldAt(e);
        if (!w) return;
        const [x, y] = drag.current;
        drag.current = [x, y, Math.hypot(w[0] - x, w[1] - y)];
        setDragTick((n) => n + 1);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setDragTick((n) => n + 1);
        if (d && d[2] >= 0.05) onBlacklist(d[0], d[1], d[2]);
      }}
    />
  );
}

async function decodeSlam(map: MapFrame): Promise<HTMLCanvasElement | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const raw = Uint8Array.from(atob(map.data), (c) => c.charCodeAt(0));
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    const c = document.createElement('canvas');
    c.width = map.w;
    c.height = map.h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(map.w, map.h);
    for (let i = 0; i < map.w * map.h && i < buf.length; i++) {
      const cell = buf[i];
      const o = i * 4;
      if (cell === 1) { img.data[o] = 25; img.data[o + 1] = 36; img.data[o + 2] = 48; img.data[o + 3] = 210; }
      else if (cell === 2) { img.data[o] = 176; img.data[o + 1] = 196; img.data[o + 2] = 212; img.data[o + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  } catch {
    return null;
  }
}
