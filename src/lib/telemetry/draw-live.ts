/** Canvas draw, ported from the robot dashboard. World scale is CSS pixels per metre. */

import type { MapFrame } from './protocol';
import type { NormState } from './normalize';

export const SCALE_MIN = 25;
export const SCALE_MAX = 220;
export const SCALE_IN = 1.12;
export const SCALE_OUT = 0.89;

export function zoomScale(scale: number, deltaY: number): number {
  const next = scale * (deltaY < 0 ? SCALE_IN : SCALE_OUT);
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
}

export function mapToOdom(mx: number, my: number, tf: [number, number, number]): [number, number] {
  const [tx, ty, th] = tf;
  return [tx + mx * Math.cos(th) - my * Math.sin(th), ty + mx * Math.sin(th) + my * Math.cos(th)];
}

export interface DrawInput {
  state: NormState | null;
  map: MapFrame | null;
  trail: [number, number][];
  scale: number;
  stale: boolean;
  slam: HTMLCanvasElement | null;
  drag: [number, number, number] | null;
  width: number;
  height: number;
  dpr?: number;
  /** Shown when there is no pose. Defaults to the connecting copy. */
  placeholder?: string | null;
}

export function drawLive(ctx: CanvasRenderingContext2D, d: DrawInput) {
  const { width: w, height: h } = d;
  const dpr = d.dpr ?? 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0f14';
  ctx.fillRect(0, 0, w, h);
  const S = d.state;
  if (!S?.pose) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7d8fa1';
    ctx.font = '14px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.placeholder || 'Waiting for robot…', w / 2, h / 2);
    return;
  }
  const [rx, ry, yaw] = S.pose;
  const cx = w / 2;
  const cy = h / 2;
  const scale = d.scale;
  const W = (x: number, y: number): [number, number] => [cx + (x - rx) * scale, cy - (y - ry) * scale];

  ctx.strokeStyle = '#15202b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const x0 = Math.floor(rx - w / 2 / scale);
  const x1 = Math.ceil(rx + w / 2 / scale);
  const y0 = Math.floor(ry - h / 2 / scale);
  const y1 = Math.ceil(ry + h / 2 / scale);
  for (let gx = x0; gx <= x1; gx++) {
    const [a, b] = W(gx, y0);
    const [c, e] = W(gx, y1);
    ctx.moveTo(a, b);
    ctx.lineTo(c, e);
  }
  for (let gy = y0; gy <= y1; gy++) {
    const [a, b] = W(x0, gy);
    const [c, e] = W(x1, gy);
    ctx.moveTo(a, b);
    ctx.lineTo(c, e);
  }
  ctx.stroke();

  const [ox, oy] = W(0, 0);
  ctx.fillStyle = '#31465c';
  ctx.fillRect(ox - 3, oy - 3, 6, 6);

  if (d.slam && d.map) {
    const [tx, ty] = d.map.tf;
    const [px, py] = W(tx, ty);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-d.map.tf[2]);
    const mw = d.map.w * d.map.res * scale;
    const mh = d.map.h * d.map.res * scale;
    ctx.drawImage(d.slam, 0, -mh, mw, mh);
    ctx.restore();
  }

  const tf = d.map?.tf;
  const toOdom = (x: number, y: number): [number, number] => (tf ? mapToOdom(x, y, tf) : [x, y]);

  if (d.map && S.frontier) {
    const fill: Record<string, string> = { bl: 'rgba(255,60,60,.22)', perm: 'rgba(15,15,15,.55)', manual: 'rgba(199,146,234,.28)' };
    const edge: Record<string, string> = { bl: '#ff5d5d', perm: '#777', manual: '#c792ea' };
    for (const [zx, zy, zr, k] of S.frontier.zones) {
      const [wx, wy] = toOdom(zx, zy);
      const [px, py] = W(wx, wy);
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
    S.frontier.queue.forEach(([qx, qy], i) => {
      const [wx, wy] = toOdom(qx, qy);
      const [px, py] = W(wx, wy);
      ctx.fillStyle = 'rgba(61,220,132,.9)';
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#04270f';
      ctx.fillText(String(i + 1), px, py + 4);
    });
  }

  if (d.trail.length > 1) {
    ctx.strokeStyle = 'rgba(79,195,247,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    d.trail.forEach((p, i) => {
      const [a, b] = W(p[0], p[1]);
      if (i) ctx.lineTo(a, b);
      else ctx.moveTo(a, b);
    });
    ctx.stroke();
  }

  if (S.path.length > 1) {
    ctx.strokeStyle = '#ffb74d';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    S.path.forEach((p, i) => {
      const [a, b] = W(p[0], p[1]);
      if (i) ctx.lineTo(a, b);
      else ctx.moveTo(a, b);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (S.goal) {
    const [wX, wY] = d.map ? toOdom(S.goal[0], S.goal[1]) : [S.goal[0], S.goal[1]];
    const [gx, gy] = W(wX, wY);
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

  if (S.seq && S.seq.goals.length) {
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    S.seq.goals.forEach(([gx, gy], i) => {
      const [px, py] = W(gx, gy);
      const isActive = i === S.seq!.idx;
      const isDone = S.seq!.idx >= 0 && i < S.seq!.idx;
      ctx.fillStyle = isActive ? '#3ddc84' : isDone ? 'rgba(125,143,161,.5)' : '#4fc3f7';
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isActive ? '#000' : '#0e141b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = isActive ? '#000' : '#0e141b';
      ctx.fillText(String(i + 1), px, py + 4);
    });
  }

  ctx.fillStyle = 'rgba(61,220,132,.75)';
  for (const [a, r] of S.scan) {
    const th = yaw + a;
    const [px, py] = W(rx + r * Math.cos(th), ry + r * Math.sin(th));
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }

  if (d.drag && d.drag[2] > 0) {
    const [px, py] = W(d.drag[0], d.drag[1]);
    ctx.beginPath();
    ctx.arc(px, py, d.drag[2] * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(199,146,234,.20)';
    ctx.fill();
    ctx.strokeStyle = '#c792ea';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#c792ea';
    ctx.textAlign = 'center';
    ctx.fillText(`${d.drag[2].toFixed(2)} m`, px, py - d.drag[2] * scale - 6);
  }

  if (d.map && S.sem.length) {
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    for (const [mx, my, label] of S.sem) {
      const [wx, wy] = toOdom(mx, my);
      const [px, py] = W(wx, wy);
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

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-yaw);
  const L = 0.5 * scale;
  const Wd = 0.36 * scale;
  ctx.fillStyle = '#1d2c3a';
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 5);
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
  const g = Math.max(-2, Math.min(2, S.imu.gz));
  if (Math.abs(g) > 0.03) {
    ctx.strokeStyle = '#c792ea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, L * 0.75, 0, -g * 1.2, g > 0);
    ctx.stroke();
  }
  ctx.restore();

  if (d.stale) {
    ctx.fillStyle = 'rgba(10,15,20,.65)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff5d5d';
    ctx.font = '20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('no data from robot…', w / 2, h / 2);
  }
}

export function canvasToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cssW: number,
  cssH: number,
  pose: [number, number, number],
  scale: number,
): [number, number] {
  const px = ((clientX - rect.left) / rect.width) * cssW;
  const py = ((clientY - rect.top) / rect.height) * cssH;
  const x = pose[0] + (px - cssW / 2) / scale;
  const y = pose[1] - (py - cssH / 2) / scale;
  return [x, y];
}
