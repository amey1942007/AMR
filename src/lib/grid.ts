import { OBSTACLES, ROOM, ROOMS, OUTSIDE, castRay, roomAt, type Box } from './room';
import { poseAt } from './path';

/** Occupancy grid 100 × 70 @ 0.1 m (art v3 §4), baked offline to public/data/map_reveal.bin (scripts/bake-map.ts). */
export const GRID = { w: 100, h: 70, cell: 0.1 } as const;
export const NEVER = 255;

export function cellOf(x: number, z: number) {
  const cx = Math.floor((x + ROOM.w / 2) / GRID.cell), cz = Math.floor((z + ROOM.d / 2) / GRID.cell);
  return cx < 0 || cz < 0 || cx >= GRID.w || cz >= GRID.h ? -1 : cz * GRID.w + cx;
}

/** revealU: ceil(u×255) at which the cell is first seen (255 never; canonical format of tools/apartment/bake-map.mjs). */
export const revealCode = (u: number) => Math.min(254, Math.ceil(u * 255));
/** Cells with code ≤ limOf(uMap) are revealed (255 = never, always excluded). */
export const limOf = (u: number) => Math.min(254, Math.ceil(u * 255));
export function bakeMap(rays = 180, step = 0.01, obstacles: Box[] = OBSTACLES) {
  const n = GRID.w * GRID.h;
  const reveal = new Uint8Array(n).fill(NEVER), state = new Uint8Array(n);
  for (let u = 0; u <= 1 + 1e-9; u += step) {
    const { x, z } = poseAt(u);
    const code = revealCode(u);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const r = castRay(x, z, a, 12, obstacles);
      const dx = Math.cos(a), dz = Math.sin(a);
      for (let d = 0; d < r.dist; d += GRID.cell * 0.5) {
        const c = cellOf(x + dx * d, z + dz * d);
        if (c >= 0 && reveal[c] === NEVER) { reveal[c] = code; state[c] = 1; }
      }
      if (r.hit) {
        const c = cellOf(r.x + dx * 0.02, r.z + dz * 0.02);
        if (c >= 0) { if (reveal[c] === NEVER || state[c] !== 2) { if (reveal[c] === NEVER) reveal[c] = code; state[c] = 2; } }
      }
    }
  }
  const room = new Uint8Array(n);
  for (let i = 0; i < n; i++) room[i] = roomAt(((i % GRID.w) + 0.5) * GRID.cell - ROOM.w / 2, (Math.floor(i / GRID.w) + 0.5) * GRID.cell - ROOM.d / 2);
  let total = 0;
  for (let i = 0; i < n; i++) if (reveal[i] !== NEVER) total++;
  return { reveal, state, room, total };
}

/** map_reveal.bin layout: 3 × (100·70) bytes = revealU ++ state ++ roomId. */
export function encodeMap(m: { reveal: Uint8Array; state: Uint8Array; room: Uint8Array }) {
  const n = GRID.w * GRID.h, out = new Uint8Array(n * 3);
  out.set(m.reveal); out.set(m.state, n); out.set(m.room, 2 * n);
  return out;
}
export function decodeMap(buf: Uint8Array) {
  const n = GRID.w * GRID.h;
  if (buf.length !== n * 3) throw new Error(`map_reveal.bin: expected ${n * 3} bytes, got ${buf.length}`);
  return { reveal: buf.slice(0, n), state: buf.slice(n, 2 * n), room: buf.slice(2 * n) };
}

/** First-entry u per room id (sampled along the path); rooms never entered → Infinity. */
export function roomEntryU(samples = 1000): number[] {
  const out = Array<number>(8).fill(Infinity);
  for (let i = 0; i <= samples; i++) {
    const u = i / samples, { x, z } = poseAt(u), r = roomAt(x, z);
    if (r !== OUTSIDE && out[r] === Infinity) out[r] = u;
  }
  return out;
}

/** Per-room completion: revealed (≤ uMap) / known interior cells of that room. */
export function roomCompletion(reveal: Uint8Array, room: Uint8Array, uMap: number) {
  const lim = limOf(uMap), seen = new Array(8).fill(0), all = new Array(8).fill(0);
  for (let i = 0; i < reveal.length; i++) {
    const r = room[i];
    if (r === OUTSIDE || reveal[i] === NEVER) continue;
    all[r]++; if (reveal[i] <= lim) seen[r]++;
  }
  return ROOMS.map((rm) => ({ id: rm.id, pct: all[rm.id] ? seen[rm.id] / all[rm.id] : 0 }));
}

/** Percent = revealed cells / known interior cells (cells outside the apartment excluded when room ids are given). */
export function mappedPct(reveal: Uint8Array, total: number, uMap: number, room?: Uint8Array) {
  const lim = limOf(uMap);
  let k = 0;
  if (room) {
    total = 0;
    for (let i = 0; i < reveal.length; i++) if (room[i] !== OUTSIDE && reveal[i] !== NEVER) { total++; if (reveal[i] <= lim) k++; }
    return total ? Math.round((k / total) * 100) : 0;
  }
  for (let i = 0; i < reveal.length; i++) if (reveal[i] !== NEVER && reveal[i] <= lim) k++;
  return total ? Math.round((k / total) * 100) : 0;
}
