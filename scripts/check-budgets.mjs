// Budgets (fails the build via `postbuild`). Initial JS = the <script src> files referenced by out/index.html
// (what the browser executes on first load: Next runtime + React + app) PLUS the motion stack fetched right after
// first paint (Lenis; GSAP/ScrollTrigger if ever re-added) — review #1. 3D/dialog chunks are budgeted separately.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const KB = 1024, MB = 1e6;
let fail = false;
const row = (ok, label, val, max) => { fail ||= !ok; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}: ${val} / ${max}`); };

const files = {
  'public/models/amr_hero_lo.glb': 0.8 * MB,
  'public/models/amr_hero_hi.glb': 12 * MB,
  'public/models/room_shell.glb': 1.2 * MB,
  'public/models/props.glb': 1.5 * MB,
  'public/hdri/studio_small_09_1k.hdr': 1.7 * MB,
  'public/hdri/studio_small_09_2k.webp': 3 * MB,
  'public/img/clouds/cloud.webp': 60 * KB,
};
for (const [f, max] of Object.entries(files)) {
  if (!existsSync(f)) { console.log(`skip  ${f} (missing → placeholder)`); continue; }
  const s = statSync(f).size;
  row(s <= max, f, `${(s / MB).toFixed(2)} MB`, `${(max / MB).toFixed(2)} MB`);
}

const html = 'out/index.html';
if (existsSync(html)) {
  const page = readFileSync(html, 'utf8');
  // Module-capable browsers skip `noModule` scripts (legacy polyfills), so they don't count.
  const srcs = [...new Set([...page.matchAll(/<script([^>]*)\ssrc="([^"]+\.js)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))];
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  let total = 0;
  for (const s of srcs) total += gzipSync(readFileSync(join('out', s.slice(base.length)))).length;
  // Review #1: the motion stack loaded right after first paint counts too (Lenis; GSAP/ScrollTrigger if present).
  const chunkDir = 'out/_next/static/chunks';
  const MOTION = /virtualScroll|lenis-smooth|_scrollTrigger|scrollerProxy|GreenSock|gsap\.registerPlugin/;
  let motion = 0, motionN = 0;
  for (const f of readdirSync(chunkDir)) {
    if (!f.endsWith('.js') || srcs.some((s) => s.endsWith(f))) continue;
    const buf = readFileSync(join(chunkDir, f));
    if (MOTION.test(buf.toString('utf8'))) { motion += gzipSync(buf).length; motionN++; }
  }
  row(total + motion <= 180 * KB, `initial JS gz (${srcs.length} scripts on / + ${motionN} motion chunk(s))`, `${((total + motion) / KB).toFixed(1)} KB`, '180 KB');
  const css = [...page.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].map((m) => m[1]);
  let cssTotal = 0;
  for (const s of new Set(css)) cssTotal += gzipSync(readFileSync(join('out', s.slice(base.length)))).length;
  row(cssTotal <= 20 * KB, 'CSS gz', `${(cssTotal / KB).toFixed(1)} KB`, '20 KB');
  // 3D: every lazy chunk of the journey, matched by literals that survive minification: three core/renderer
  // ('WebGLRenderer', 'BufferGeometry'), the journey app chunk ('cloud_volume') and N8AO ('denoiseSamples'). The old
  // single 'WebGLRenderer' marker silently missed the app chunk once code moved between chunks. model-viewer (no-WebGL
  // fallback only) and the motion chunk (counted above) are excluded.
  // BUDGET: 420 KB core + 100 KB allowance for N8AO (required by review #12; ~94 KB gz on its own) = 520 KB.
  // The +100 KB N8AO allowance is approved 2026-10-14; N8AO streams after first paint.
  const dir = 'out/_next/static/chunks';
  const initial = new Set(srcs.map((s) => s.split('/').pop()));
  let three = 0, n3 = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js') || initial.has(f)) continue;
    const buf = readFileSync(join(dir, f)), txt = buf.toString('latin1');
    if (txt.includes('model-viewer') || MOTION.test(txt)) continue;
    if (/WebGLRenderer|BufferGeometry|cloud_volume|denoiseSamples/.test(txt)) { three += gzipSync(buf).length; n3++; }
  }
  row(three <= 520 * KB, `3D chunks gz (${n3} deferred chunks incl. N8AO)`, `${(three / KB).toFixed(1)} KB`, '520 KB (420 + 100 N8AO, approved 2026-10-14)');
} else console.log('skip  out/index.html (run after `next build`)');
process.exit(fail ? 1 : 0);
