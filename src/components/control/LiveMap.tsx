'use client';
import { useEffect, useRef, useState } from 'react';
import type { BotTelemetry, MapFrame } from '@/lib/telemetry/protocol';

export type CanvasNavMode = 'off' | 'goal' | 'sequential' | 'nogo';

type WorldPt = [number, number];

function mapToOdom(mx: number, my: number, tf: [number, number, number]): WorldPt {
  const [tx, ty, th] = tf;
  return [tx + mx * Math.cos(th) - my * Math.sin(th), ty + mx * Math.sin(th) + my * Math.cos(th)];
}

/**
 * 2D odom-frame live view — mirrors robot_dashboard_node canvas:
 * lidar scan, 2D robot body, path/goal, frontier zones, semantic labels.
 * Wheel-zoom; click / drag for nav & no-go modes.
 */
export function LiveMap({
  frame,
  map,
  navMode,
  sequentialQueue,
  canInteract,
  onNavGoal,
  onBlacklist,
  placeholder = 'Waiting for robot…',
  className = '',
}: {
  frame: BotTelemetry | null;
  map: MapFrame | null;
  navMode: CanvasNavMode;
  sequentialQueue: WorldPt[];
  canInteract: boolean;
  onNavGoal: (x: number, y: number) => void;
  onBlacklist: (x: number, y: number, radius: number) => void;
  /** Shown when no pose has arrived. Not an aria-live region — the header announces the phase. */
  placeholder?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const mapRef = useRef(map);
  const modeRef = useRef(navMode);
  const queueRef = useRef(sequentialQueue);
  const trailRef = useRef<WorldPt[]>([]);
  const scaleRef = useRef(70);
  const blDragRef = useRef<[number, number, number] | null>(null);
  const lastSeenRef = useRef(0);
  const placeholderRef = useRef(placeholder);
  const [size, setSize] = useState({ w: 900, h: 560 });

  useEffect(() => {
    frameRef.current = frame;
    mapRef.current = map;
    modeRef.current = navMode;
    queueRef.current = sequentialQueue;
    placeholderRef.current = placeholder;
  }, [frame, map, navMode, sequentialQueue, placeholder]);

  useEffect(() => {
    if (!frame?.pose) return;
    lastSeenRef.current = Date.now();
    const [x, y] = frame.pose;
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(x - last[0], y - last[1]) > 0.02) {
      trail.push([x, y]);
      if (trail.length > 600) trail.shift();
    }
  }, [frame?.pose, frame?.seq]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, Math.floor(r.width)), h: Math.max(280, Math.floor(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const W = cv.width;
      const H = cv.height;
      const S = frameRef.current;
      const MAP = mapRef.current;
      const scale = scaleRef.current;

      ctx.fillStyle = '#070a10';
      ctx.fillRect(0, 0, W, H);
      if (!S?.pose) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#7d8fa1';
        ctx.font = '14px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(placeholderRef.current, W / 2, H / 2);
        return;
      }
      ctx.textBaseline = 'alphabetic';

      const [rx, ry, yaw] = S.pose;
      const cx = W / 2;
      const cy = H / 2;
      const toPx = (x: number, y: number): WorldPt => [cx + (x - rx) * scale, cy - (y - ry) * scale];

      // 1 m grid
      ctx.strokeStyle = '#121820';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const x0 = Math.floor(rx - W / 2 / scale);
      const x1 = Math.ceil(rx + W / 2 / scale);
      const y0 = Math.floor(ry - H / 2 / scale);
      const y1 = Math.ceil(ry + H / 2 / scale);
      for (let gx = x0; gx <= x1; gx++) {
        const [a, b] = toPx(gx, y0);
        const [c, d] = toPx(gx, y1);
        ctx.moveTo(a, b);
        ctx.lineTo(c, d);
      }
      for (let gy = y0; gy <= y1; gy++) {
        const [a, b] = toPx(x0, gy);
        const [c, d] = toPx(x1, gy);
        ctx.moveTo(a, b);
        ctx.lineTo(c, d);
      }
      ctx.stroke();

      const [ox, oy] = toPx(0, 0);
      ctx.fillStyle = '#2a3a4c';
      ctx.fillRect(ox - 3, oy - 3, 6, 6);

      // Frontier zones + queue (map → odom)
      if (MAP?.tf && S.frontier) {
        const fill: Record<string, string> = {
          bl: 'rgba(255,60,60,.22)',
          perm: 'rgba(15,15,15,.55)',
          manual: 'rgba(199,146,234,.28)',
        };
        const edge: Record<string, string> = {
          bl: '#ff5d5d',
          perm: '#777',
          manual: '#c792ea',
        };
        for (const z of S.frontier.zones || []) {
          const zx = Number(z[0]);
          const zy = Number(z[1]);
          const zr = Number(z[2]);
          const k = String(z[3] ?? 'bl');
          if (!Number.isFinite(zx) || !Number.isFinite(zy) || !Number.isFinite(zr)) continue;
          const [wx, wy] = mapToOdom(zx, zy, MAP.tf);
          const [px, py] = toPx(wx, wy);
          ctx.beginPath();
          ctx.arc(px, py, zr * scale, 0, Math.PI * 2);
          ctx.fillStyle = fill[k] || fill.bl;
          ctx.fill();
          ctx.strokeStyle = edge[k] || edge.bl;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        (S.frontier.queue || []).forEach(([qx, qy], i) => {
          const [wx, wy] = mapToOdom(qx, qy, MAP.tf);
          const [px, py] = toPx(wx, wy);
          ctx.fillStyle = 'rgba(61,220,132,.9)';
          ctx.beginPath();
          ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#04270f';
          ctx.fillText(String(i + 1), px, py + 4);
        });
      }

      // Trail
      const trail = trailRef.current;
      if (trail.length > 1) {
        ctx.strokeStyle = 'rgba(79,195,247,.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        trail.forEach((p, i) => {
          const [a, b] = toPx(p[0], p[1]);
          if (i) ctx.lineTo(a, b);
          else ctx.moveTo(a, b);
        });
        ctx.stroke();
      }

      // Nav path
      if (S.path && S.path.length > 1) {
        ctx.strokeStyle = '#ffb74d';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        S.path.forEach((p, i) => {
          const [a, b] = toPx(p[0], p[1]);
          if (i) ctx.lineTo(a, b);
          else ctx.moveTo(a, b);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Active goal flag
      if (S.goal) {
        const [gx, gy] = toPx(S.goal[0], S.goal[1]);
        ctx.strokeStyle = '#ff5d5d';
        ctx.fillStyle = '#ff5d5d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx, gy - 28);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gx, gy - 28);
        ctx.lineTo(gx + 16, gy - 22);
        ctx.lineTo(gx, gy - 16);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx, gy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sequential queue markers (client-side)
      const seq = queueRef.current;
      if (seq.length) {
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        seq.forEach(([qx, qy], i) => {
          const [px, py] = toPx(qx, qy);
          ctx.fillStyle = 'rgba(123,47,247,.85)';
          ctx.beginPath();
          ctx.arc(px, py, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(String(i + 1), px, py + 4);
        });
      }

      // Lidar [angle, range] in laser frame → world via yaw
      if (S.scan?.length) {
        ctx.fillStyle = 'rgba(61,220,132,.75)';
        for (const [a, r] of S.scan) {
          if (!Number.isFinite(a) || !Number.isFinite(r) || r <= 0) continue;
          const th = yaw + a;
          const [px, py] = toPx(rx + r * Math.cos(th), ry + r * Math.sin(th));
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }

      // No-go drag preview
      const bl = blDragRef.current;
      if (bl && bl[2] > 0) {
        const [px, py] = toPx(bl[0], bl[1]);
        ctx.beginPath();
        ctx.arc(px, py, bl[2] * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(199,146,234,.20)';
        ctx.fill();
        ctx.strokeStyle = '#c792ea';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = '12px system-ui';
        ctx.fillStyle = '#c792ea';
        ctx.textAlign = 'center';
        ctx.fillText(`${bl[2].toFixed(2)} m`, px, py - bl[2] * scale - 6);
      }

      // Semantic labels
      if (MAP?.tf && S.sem?.length) {
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        for (const [mx, my, label] of S.sem) {
          const [wx, wy] = mapToOdom(mx, my, MAP.tf);
          const [px, py] = toPx(wx, wy);
          ctx.fillStyle = '#ffb74d';
          ctx.beginPath();
          ctx.moveTo(px, py - 5);
          ctx.lineTo(px + 5, py);
          ctx.lineTo(px, py + 5);
          ctx.lineTo(px - 5, py);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffd9a0';
          ctx.fillText(label, px, py - 8);
        }
      }

      // 2D robot body (0.50 × 0.36 m) — not a 3D mesh
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-yaw);
      const L = 0.5 * scale;
      const Wd = 0.36 * scale;
      ctx.fillStyle = '#1d2c3a';
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 5);
      else ctx.rect(-L / 2, -Wd / 2, L, Wd);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#31465c';
      ctx.fillRect(-L * 0.32, -Wd / 2 - 3, L * 0.28, 6);
      ctx.fillRect(-L * 0.32, Wd / 2 - 3, L * 0.28, 6);
      ctx.fillRect(L * 0.05, -Wd / 2 - 3, L * 0.28, 6);
      ctx.fillRect(L * 0.05, Wd / 2 - 3, L * 0.28, 6);
      ctx.strokeStyle = '#ffb74d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(L * 0.65, 0);
      ctx.moveTo(L * 0.5, -6);
      ctx.lineTo(L * 0.65, 0);
      ctx.lineTo(L * 0.5, 6);
      ctx.stroke();
      const g = Math.max(-2, Math.min(2, S.imu?.gz ?? 0));
      if (Math.abs(g) > 0.03) {
        ctx.strokeStyle = '#c792ea';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, L * 0.75, 0, -g * 1.2, g > 0);
        ctx.stroke();
      }
      ctx.restore();

      if (Date.now() - lastSeenRef.current > 2000) {
        ctx.fillStyle = 'rgba(7,10,16,.65)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff5d5d';
        ctx.font = '18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('no data from robot…', W / 2, H / 2);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h]);

  const canvasToWorld = (clientX: number, clientY: number): WorldPt | null => {
    const cv = canvasRef.current;
    const S = frameRef.current;
    if (!cv || !S?.pose) return null;
    const r = cv.getBoundingClientRect();
    const px = (clientX - r.left) * (cv.width / r.width);
    const py = (clientY - r.top) * (cv.height / r.height);
    const scale = scaleRef.current;
    return [
      S.pose[0] + (px - cv.width / 2) / scale,
      S.pose[1] - (py - cv.height / 2) / scale,
    ];
  };

  return (
    <div ref={wrapRef} className={`relative h-full min-h-[280px] w-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="size-full touch-none"
        style={{ cursor: navMode === 'off' || !canInteract ? 'default' : navMode === 'nogo' ? 'crosshair' : 'pointer' }}
        onWheel={(e) => {
          e.preventDefault();
          scaleRef.current = Math.max(25, Math.min(220, scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.89)));
        }}
        onClick={(e) => {
          if (!canInteract) return;
          const mode = modeRef.current;
          if (mode !== 'goal' && mode !== 'sequential') return;
          const w = canvasToWorld(e.clientX, e.clientY);
          if (!w) return;
          onNavGoal(+w[0].toFixed(2), +w[1].toFixed(2));
        }}
        onPointerDown={(e) => {
          if (!canInteract || modeRef.current !== 'nogo') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const w = canvasToWorld(e.clientX, e.clientY);
          if (!w) return;
          blDragRef.current = [w[0], w[1], 0];
        }}
        onPointerMove={(e) => {
          const bl = blDragRef.current;
          if (!bl) return;
          const w = canvasToWorld(e.clientX, e.clientY);
          if (!w) return;
          bl[2] = Math.hypot(w[0] - bl[0], w[1] - bl[1]);
        }}
        onPointerUp={() => {
          const bl = blDragRef.current;
          blDragRef.current = null;
          if (!bl || bl[2] < 0.05 || !canInteract) return;
          onBlacklist(bl[0], bl[1], bl[2]);
        }}
        onPointerCancel={() => {
          blDragRef.current = null;
        }}
        role="img"
        aria-label={frame?.pose ? 'Live robot map — odom frame' : placeholder}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-white/60">
        odom · wheel-zoom · {navMode === 'off' ? 'view' : navMode}
      </div>
    </div>
  );
}
