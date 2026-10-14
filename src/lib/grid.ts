import { OBSTACLES, ROOM, castRay, type Box } from './room';
import { poseAt } from './path';

/** Occupancy grid 80 × 60 @ 0.1 m (brief §11.5), deterministic "bake" computed at runtime from the shared layout. */
export const GRID = { w: 80, h: 60, cell: 0.1 } as const;
export const NEVER = 255;

export function cellOf(x: number, z: number) {
  const cx = Math.floor((x + ROOM.w / 2) / GRID.cell), cz = Math.floor((z + ROOM.d / 2) / GRID.cell);
  return cx < 0 || cz < 0 || cx >= GRID.w || cz >= GRID.h ? -1 : cz * GRID.w + cx;
}

/** revealU: u×254 at which the cell is first seen (255 never). state: 1 free, 2 occupied. */
export function bakeMap(rays = 180, step = 0.01, obstacles: Box[] = OBSTACLES) {
  const n = GRID.w * GRID.h;
  const reveal = new Uint8Array(n).fill(NEVER), state = new Uint8Array(n);
  for (let u = 0; u <= 1 + 1e-9; u += step) {
    const { x, z } = poseAt(u);
    const code = Math.round(u * 254);
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
  let total = 0;
  for (let i = 0; i < n; i++) if (reveal[i] !== NEVER) total++;
  return { reveal, state, total };
}

export function mappedPct(reveal: Uint8Array, total: number, uMap: number) {
  const lim = Math.round(uMap * 254);
  let k = 0;
  for (let i = 0; i < reveal.length; i++) if (reveal[i] <= lim) k++;
  return total ? Math.round((k / total) * 100) : 0;
}
