// Bakes a floor ambient-occlusion texture for the LOW tier (no realtime shadows) from src/data/apartment.json.
// Walls + furniture footprints darken the floor with a soft distance falloff, plus a directional offset toward
// the key light's shadow side (+x, +z away from light dir (3,5,2)). Output: public/textures/floor_ao.webp (1024×716).
import { readFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
const A = JSON.parse(readFileSync(new URL('../../src/data/apartment.json', import.meta.url)));
const W = 1024, H = Math.round((W * A.footprint.d) / A.footprint.w), sx = A.footprint.w / W, sz = A.footprint.d / H;
const rects = [];
for (const w of A.walls) {
  const [x0, z0] = w.from, [x1, z1] = w.to, t = w.thickness / 2;
  rects.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2 + t, hz: Math.abs(z1 - z0) / 2 + t, c: 0, s: 0, k: 0.3, h: w.height });
}
for (const f of A.furniture) {
  if (f.position[1] > 0.3) continue; // items on counters don't occlude the floor
  const c = { w: f.collider?.w ?? f.size[0], d: f.collider?.d ?? f.size[2], h: f.collider?.h ?? f.size[1] }, a = ((f.yaw ?? 0) * Math.PI) / 180;
  if (c.h < 0.05) continue; // rugs don't occlude
  rects.push({ cx: f.position[0], cz: f.position[2], hx: c.w / 2, hz: c.d / 2, c: Math.cos(a), s: Math.sin(a), k: 0.5, h: c.h ?? f.size[1] });
}
const L = { x: -3 / 5, z: -2 / 5 }; // shadow falls away from the light, i.e. toward -light.xz per metre of height
const img = new Float32Array(W * H).fill(1);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = -A.footprint.w / 2 + (i + 0.5) * sx, z = -A.footprint.d / 2 + (j + 0.5) * sz;
  let ao = 1;
  for (const r of rects) {
    for (const [ox, oz, k, fall] of [[0, 0, r.k, 0.07], [L.x * r.h * 0.4, L.z * r.h * 0.4, r.k * 0.35, 0.18]]) {
      let dx = x + ox * -1 - r.cx, dz = z + oz * -1 - r.cz;
      if (r.s || r.c) { const u = dx * r.c - dz * r.s, v = dx * r.s + dz * r.c; dx = u; dz = v; }
      const ex = Math.max(Math.abs(dx) - r.hx, 0), ez = Math.max(Math.abs(dz) - r.hz, 0), d = Math.hypot(ex, ez);
      ao *= 1 - k * Math.exp(-d / fall);
    }
  }
  img[j * W + i] = ao;
}
const buf = Buffer.alloc(W * H);
for (let p = 0; p < W * H; p++) buf[p] = Math.round(255 * Math.max(0.45, img[p]));
mkdirSync('public/textures', { recursive: true });
await sharp(buf, { raw: { width: W, height: H, channels: 1 } }).blur(1.2).webp({ quality: 80 }).toFile('public/textures/floor_ao.webp');
console.log(`wrote public/textures/floor_ao.webp ${W}x${H} from ${rects.length} occluders`);
