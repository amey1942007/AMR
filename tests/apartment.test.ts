import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { OBSTACLES, ROOMS, WALLS, roomAt, type Box } from '@/lib/room';
import { pathLength, poseAt } from '@/lib/path';
import { bakeMap, decodeMap, roomCompletion, roomEntryU, GRID } from '@/lib/grid';

/** Robot footprint (AMR4) 0.63 long (+Z) × 0.52 wide (X) as a yawed rectangle; SAT vs yawed boxes in XZ. */
function corners(x: number, z: number, w: number, d: number, yaw: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [x + a * c + b * s, z - a * s + b * c]);
}
function overlap(A: number[][], B: number[][]) {
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % 4], nx = z2 - z1, nz = x1 - x2;
    const pa = A.map(([x, z]) => x * nx + z * nz), pb = B.map(([x, z]) => x * nx + z * nz);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

describe('v3 apartment', () => {
  it('path is ≈ 20.7 m', () => expect(pathLength()).toBeGreaterThan(19.5) );
  it('path: 400 samples, robot footprint never overlaps walls or furniture (§3.1 CI check)', () => {
    const hits: string[] = [];
    for (let i = 0; i <= 400; i++) {
      const u = i / 400, p = poseAt(u), R = corners(p.x, p.z, 0.52, 0.63, p.yaw);
      for (const b of OBSTACLES as Box[]) if (overlap(R, corners(b.x, b.z, b.w, b.d, b.yaw))) hits.push(`${u.toFixed(3)}:${b.name}`);
    }
    expect(hits).toEqual([]);
  });
  it('every room is entered by the path, in order living → … → bedroom 1', () => {
    const e = roomEntryU();
    for (const r of ROOMS) expect(Number.isFinite(e[r.id])).toBe(true);
    expect(e[1]).toBeLessThan(e[3]); expect(e[3]).toBeLessThan(e[4]); expect(e[4]).toBeLessThan(e[5]); expect(e[5]).toBeLessThan(e[6]);
  });
  it('walls stay inside the 10 × 7 footprint and doors are open', () => {
    for (const w of WALLS) { expect(Math.abs(w.x)).toBeLessThanOrEqual(5.1); expect(Math.abs(w.z)).toBeLessThanOrEqual(3.6); }
    expect(roomAt(-4, 2)).toBe(1); expect(roomAt(3, -2)).toBe(5); expect(roomAt(9, 9)).toBe(255);
  });
  it('minimap rooms reveal room by room and the baked bin matches the runtime bake', () => {
    const m = bakeMap(90, 0.02);
    const start = roomCompletion(m.reveal, m.room, 0.05), end = roomCompletion(m.reveal, m.room, 1);
    expect(start.find((r) => r.id === 1)!.pct).toBeGreaterThan(0.3);
    expect(start.find((r) => r.id === 6)!.pct).toBeLessThan(0.2);
    for (const r of end) expect(r.pct).toBeCloseTo(1, 5);
    if (existsSync('public/data/map_reveal.bin')) {
      const b = decodeMap(new Uint8Array(readFileSync('public/data/map_reveal.bin')));
      expect(b.room.length).toBe(GRID.w * GRID.h);
    }
  });
});

describe('lidar rays stay inside the apartment (review #12)', () => {
  it('never ends outside the inner shell, including through door gaps', async () => {
    const { castRay, ROOM } = await import('@/lib/room');
    const { PATH_POINTS } = await import('@/lib/path');
    const hx = ROOM.w / 2 - ROOM.wallT / 2 + 1e-6, hz = ROOM.d / 2 - ROOM.wallT / 2 + 1e-6;
    for (const p of PATH_POINTS as unknown as [number, number][]) {
      const [x, z] = Array.isArray(p) ? p : [(p as { x: number }).x, (p as { z: number }).z];
      for (let i = 0; i < 360; i++) {
        const r = castRay(x, z, (i / 360) * Math.PI * 2);
        expect(Math.abs(r.x)).toBeLessThanOrEqual(hx);
        expect(Math.abs(r.z)).toBeLessThanOrEqual(hz);
      }
    }
  });
});
