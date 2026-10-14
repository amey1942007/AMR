// Budgets (fails the build via `postbuild`). Initial JS = the <script src> files referenced by out/index.html
// (what the browser executes on first load: Next runtime + React + app, incl. any gsap/lenis pulled in eagerly).
// Lazy chunks (3D, dialogs, gsap/lenis loaded after paint) are not referenced there and are budgeted separately.
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
  row(total <= 180 * KB, `initial JS gz (${srcs.length} scripts on /)`, `${(total / KB).toFixed(1)} KB`, '180 KB');
  const css = [...page.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].map((m) => m[1]);
  let cssTotal = 0;
  for (const s of new Set(css)) cssTotal += gzipSync(readFileSync(join('out', s.slice(base.length)))).length;
  row(cssTotal <= 20 * KB, 'CSS gz', `${(cssTotal / KB).toFixed(1)} KB`, '20 KB');
  // 3D chunk: largest lazy chunk containing three.js
  const dir = 'out/_next/static/chunks';
  let three = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const buf = readFileSync(join(dir, f));
    if (buf.includes('WebGLRenderer')) three += gzipSync(buf).length;
  }
  row(three <= 420 * KB, '3D chunk(s) gz', `${(three / KB).toFixed(1)} KB`, '420 KB');
} else console.log('skip  out/index.html (run after `next build`)');
process.exit(fail ? 1 : 0);
