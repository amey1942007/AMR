'use client';
import { useEffect, useRef, useState } from 'react';
import { S } from '@/lib/scene-state';
import { useScene, robotScreen, robotPose } from '@/lib/store';
import { useTick } from '@/components/journey/useTick';
import { copy } from '@/lib/content';
import { GRID, NEVER, mappedPct } from '@/lib/grid';
import { ROOM } from '@/lib/room';
import { pathCurve } from '@/lib/path';
import { useServices } from '@/components/providers/ServicesProvider';
import { Vector3 } from 'three';

const KEYS = ['c1', 'c2', 'c3'] as const;

/** Fixed overlay layer (z 10): callouts + leader, DataChip, Minimap, "Beyond the room." — all aria-hidden (story in SrDescription). */
export function Overlays({ tier, mobile }: { tier: 'high' | 'low'; mobile: boolean }) {
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const path = useRef<SVGPathElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const beyond = useRef<HTMLParagraphElement>(null);
  const mapWrap = useRef<HTMLDivElement>(null);
  useTick(() => {
    let active: HTMLDivElement | null = null, best = 0;
    KEYS.forEach((k, i) => {
      const el = cards.current[i];
      if (!el) return;
      const v = S[k];
      el.style.opacity = String(v);
      el.style.transform = `translateY(${24 * (1 - v)}px)`;
      el.style.visibility = v < 0.005 ? 'hidden' : 'visible';
      if (v > best) { best = v; active = el; }
    });
    if (path.current) {
      const a = active as HTMLDivElement | null;
      if (a && robotScreen.visible && best > 0.05 && !mobile) {
        const r = a.getBoundingClientRect();
        const x0 = r.left, y0 = r.top + r.height / 2, x1 = robotScreen.x, y1 = robotScreen.y;
        const mx = (x0 + x1) / 2;
        path.current.setAttribute('d', `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`);
        path.current.style.opacity = String(best);
      } else path.current.style.opacity = '0';
    }
    if (chip.current) chip.current.style.opacity = String(S.chip);
    if (beyond.current) beyond.current.style.opacity = String(S.beyond);
    if (mapWrap.current) { mapWrap.current.style.opacity = String(S.minimap); mapWrap.current.style.visibility = S.minimap < 0.005 ? 'hidden' : 'visible'; }
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 text-white" style={{ zIndex: 10 }}>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="leader-grad" x1="0" x2="1"><stop offset="0" stopColor="#7B2FF7" /><stop offset="1" stopColor="#E81CB0" /></linearGradient>
        </defs>
        <path ref={path} fill="none" stroke="url(#leader-grad)" strokeWidth="1" style={{ opacity: 0 }} />
      </svg>
      <div className={mobile ? 'absolute inset-x-[var(--gutter)] bottom-[var(--gutter)]' : 'callout-col absolute right-[var(--gutter)] w-[min(360px,28vw)] max-lg:w-[min(360px,30vw)]'}>
        <div className="relative">
          {copy.callouts.map((c, i) => (
            <div key={c.id} ref={(el) => { cards.current[i] = el; }} className={`glass rounded-[var(--radius-card)] p-5 ${i ? 'absolute inset-x-0 top-0' : 'relative'}`} style={{ opacity: 0, visibility: 'hidden' }}>
              <p className="eyebrow text-muted">{c.eyebrow}</p>
              <p className="mt-3 text-[length:var(--text-callout)] font-semibold leading-[1.2] tracking-[-0.01em]">{c.title}</p>
            </div>
          ))}
        </div>
        {!mobile && (
          <div ref={chip} className="glass mt-4 inline-block rounded-[var(--radius-chip)] px-3 py-2 font-mono text-[0.75rem]" style={{ opacity: 0 }}>
            <DataChipText rays={tier === 'high' ? 180 : 90} />
          </div>
        )}
      </div>
      <p ref={beyond} className="absolute inset-0 grid place-items-center text-center font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]" style={{ opacity: 0, background: 'radial-gradient(closest-side, rgba(0,0,0,.4), transparent)' }}>
        {copy.beyond}
      </p>
      {!mobile && (
        <div ref={mapWrap} className="absolute right-[var(--gutter)] bottom-[var(--gutter)]" style={{ opacity: 0, visibility: 'hidden' }}>
          <Minimap />
        </div>
      )}
    </div>
  );
}

/** `SIM · v 0.42 m/s · rays 180 · map 37%` — ≤10 Hz (G9: speed is simulated → SIM prefix). */
function DataChipText({ rays }: { rays: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const s = useScene.getState();
      if (ref.current) ref.current.textContent = `SIM · v ${s.speed.toFixed(2)} m/s · rays ${rays} · map ${s.mapPct}%`;
    }, 100);
    return () => clearInterval(id);
  }, [rays]);
  return <span ref={ref}>SIM · v 0.00 m/s · rays {rays} · map 0%</span>;
}

function Minimap({ width = 240, height = 180 }: { width?: number; height?: number }) {
  const { mapData } = useServices();
  const canvas = useRef<HTMLCanvasElement>(null);
  const header = useRef<HTMLSpanElement>(null);
  const [data, setData] = useState<{ reveal: Uint8Array; state: Uint8Array; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [label, setLabel] = useState('Occupancy map, 0% mapped');
  const last = useRef({ uMap: -1, x: 0, z: 0, flash: new Float32Array(0), drawnLim: -1 });
  const trail = useRef<{ x: number; z: number }[]>([]);

  useEffect(() => {
    mapData.loadReveal().then((buf) => {
      const n = GRID.w * GRID.h, reveal = buf.slice(0, n), state = buf.slice(n);
      let total = 0;
      for (let i = 0; i < n; i++) if (reveal[i] !== NEVER) total++;
      last.current.flash = new Float32Array(n);
      setData({ reveal, state, total });
    }).catch(() => setFailed(true));
    const c = pathCurve(), v = new Vector3();
    trail.current = Array.from({ length: 200 }, (_, i) => { c.getPointAt(i / 199, v); return { x: v.x, z: v.z }; });
  }, [mapData]);

  useTick((t) => {
    const cv = canvas.current;
    if (!cv || !data || S.minimap < 0.005) return;
    const L = last.current, uMap = useScene.getState().uMap;
    const moved = Math.abs(robotPose.x - L.x) + Math.abs(robotPose.z - L.z) > 0.005;
    const flashing = L.flash.some((f) => f > 0);
    if (uMap === L.uMap && !moved && !flashing) return;
    const lim = Math.round(uMap * 254);
    if (uMap !== L.uMap) {
      const pct = mappedPct(data.reveal, data.total, uMap);
      useScene.setState({ mapPct: pct });
      if (header.current) header.current.textContent = `OCCUPANCY MAP · ${pct}%`;
      const step = Math.floor(pct / 10) * 10;
      setLabel((l) => (l.includes(`${step}%`) ? l : `Occupancy map, ${step}% mapped`));
      if (lim > L.drawnLim) for (let i = 0; i < data.reveal.length; i++) if (data.reveal[i] > L.drawnLim && data.reveal[i] <= lim) L.flash[i] = t;
      L.drawnLim = lim; L.uMap = uMap;
    }
    L.x = robotPose.x; L.z = robotPose.z;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== width * dpr) { cv.width = width * dpr; cv.height = height * dpr; }
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    g.fillStyle = '#0B0B10'; g.fillRect(0, 0, width, height);
    const cw = width / GRID.w, ch = height / GRID.h;
    let still = false;
    for (let i = 0; i < data.reveal.length; i++) {
      if (data.reveal[i] > lim) continue;
      const occ = data.state[i] === 2;
      const age = L.flash[i] ? (t - L.flash[i]) / 0.25 : 1;
      if (age < 1) { still = true; g.fillStyle = `rgba(255,255,255,${0.9 * (1 - age)})`; g.fillRect((i % GRID.w) * cw, Math.floor(i / GRID.w) * ch, cw + 0.3, ch + 0.3); }
      else if (L.flash[i]) L.flash[i] = 0;
      g.fillStyle = occ ? '#E81CB0' : 'rgba(255,255,255,.08)';
      if (age >= 1) g.fillRect((i % GRID.w) * cw, Math.floor(i / GRID.w) * ch, cw + 0.3, ch + 0.3);
    }
    if (!still) L.flash.fill(0);
    const sx = (x: number) => ((x + ROOM.w / 2) / ROOM.w) * width, sz = (z: number) => ((z + ROOM.d / 2) / ROOM.d) * height;
    const k = Math.floor(S.uDrive * 199);
    if (k > 0) {
      const grad = g.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, '#7B2FF7'); grad.addColorStop(1, '#E81CB0');
      g.strokeStyle = grad; g.lineWidth = 1; g.beginPath();
      trail.current.slice(0, k + 1).forEach((p, i) => (i ? g.lineTo(sx(p.x), sz(p.z)) : g.moveTo(sx(p.x), sz(p.z))));
      g.stroke();
    }
    g.save();
    g.translate(sx(robotPose.x), sz(robotPose.z));
    g.rotate(-robotPose.yaw + Math.PI / 2); // world yaw (+Z forward) → canvas
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, 4); g.lineTo(-4, -4); g.closePath(); g.fill();
    g.restore();
  });

  if (failed) return null;
  return (
    <div role="img" aria-label={label} className="glass rounded-[var(--radius-card)] p-[10px]">
      <p className="mb-2 font-mono text-[0.7rem] font-medium tracking-[0.12em] uppercase leading-none"><span ref={header}>OCCUPANCY MAP · {data ? '0%' : '—'}</span></p>
      <canvas ref={canvas} style={{ width, height, display: 'block', borderRadius: 6 }} className="minimap-canvas" />
    </div>
  );
}
