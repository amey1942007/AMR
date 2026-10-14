// Shared geometry for check-path / bake-map, built only from site/src/data/apartment.json.
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs'; import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const THREE = await import(pathToFileURL(path.resolve(here, '../../node_modules/three/build/three.module.js')).href);
export const A = JSON.parse(fs.readFileSync(path.resolve(here, '../../src/data/apartment.json'), 'utf8'));
// The route is built by the same module the site uses (lines + fillets + cusps), so the check sees the real path.
const { buildPath } = await import(pathToFileURL(path.resolve(here, '../../src/lib/path-core.mjs')).href);
export const route = buildPath(A.path.route, A.path.fillet);
export const pathLength = route.length;
/** Pose at normalised arc length u (0..1); heading is the route's target heading (three.js rotation.y). */
export function pose(u) {
  const q = route.at(Math.min(1, Math.max(0, u)) * pathLength);
  return { x: q.x, z: q.z, heading: q.heading };
}
/** Extra poses at each cusp: the in-place rotation from the arriving to the leaving heading (12 steps). */
export function cuspPoses() {
  const out = [];
  for (const c of route.cuspS) { const q = route.at(c), h0 = route.heading(c - 0.02), h1 = route.heading(c + 0.02);
    for (let k = 0; k <= 12; k++) out.push({ u: c / pathLength, x: q.x, z: q.z, heading: h0 + ((h1 - h0) * k) / 12 }); }
  return out;
}
// oriented rectangles: {cx, cz, hw (half along local x), hd (half along local z), ang (rad, three rotation.y)}
export const obstacles = [
  // Walls are extended by t/2 only at ends that meet another wall (closing the corner). A free end is a door jamb
  // and stays where it is, so doorways keep their real width (0.9 m) instead of shrinking by a wall thickness.
  ...A.walls.map((w) => { const horiz = w.from[1] === w.to[1];
    const joined = (p) => A.walls.some((o) => o !== w && Math.min(o.from[0], o.to[0]) - 1e-6 <= p[0] && p[0] <= Math.max(o.from[0], o.to[0]) + 1e-6 && Math.min(o.from[1], o.to[1]) - 1e-6 <= p[1] && p[1] <= Math.max(o.from[1], o.to[1]) + 1e-6);
    const e0 = joined(w.from) ? w.thickness / 2 : 0, e1 = joined(w.to) ? w.thickness / 2 : 0;
    const a = horiz ? w.from[0] : w.from[1], b = horiz ? w.to[0] : w.to[1], sgn = Math.sign(b - a) || 1;
    const lo = a - sgn * e0, hi = b + sgn * e1, mid = (lo + hi) / 2, half = Math.abs(hi - lo) / 2;
    return { id: w.id, kind: 'wall', cx: horiz ? mid : w.center[0], cz: horiz ? w.center[1] : mid, hw: horiz ? half : w.thickness / 2, hd: horiz ? w.thickness / 2 : half, ang: 0, h: w.height }; }),
  ...A.furniture.filter((f) => f.collider).map((f) => ({ id: f.node, kind: 'prop', cx: f.position[0], cz: f.position[2], hw: f.collider.w / 2, hd: f.collider.d / 2, ang: f.yaw * Math.PI / 180, h: f.collider.h })),
];
// rect corners in world (local x axis = (cos a, -sin a), local z axis = (sin a, cos a) for three.js rotation.y = a)
export function corners(r) { const c = Math.cos(r.ang), s = Math.sin(r.ang); const ax = [c, -s], az = [s, c];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [r.cx + i * r.hw * ax[0] + j * r.hd * az[0], r.cz + i * r.hw * ax[1] + j * r.hd * az[1]]); }
function axes(r) { const c = Math.cos(r.ang), s = Math.sin(r.ang); return [[c, -s], [s, c]]; }
// separating-axis gap (>0 = separated by at least that much along the best axis; <0 = overlap depth)
export function gap(a, b) { let best = -Infinity; const ca = corners(a), cb = corners(b);
  for (const ax of [...axes(a), ...axes(b)]) { const pa = ca.map((p) => p[0] * ax[0] + p[1] * ax[1]), pb = cb.map((p) => p[0] * ax[0] + p[1] * ax[1]);
    const g = Math.max(Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb)); best = Math.max(best, g); }
  return best; }
export function robotRect(u, q = pose(u)) { const f = A.path.robotFootprint; return { ...q, cx: q.x, cz: q.z, hw: f.width / 2, hd: f.length / 2, ang: q.heading }; }
export function roomAt(x, z) { const r = A.rooms.find((r) => x >= r.x[0] && x < r.x[1] && z >= r.z[0] && z < r.z[1]); return r ? r : null; }
