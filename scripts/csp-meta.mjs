// Review login #4: CSP on every exported page. GitHub Pages can't send headers, so each HTML file gets a
// <meta http-equiv="Content-Security-Policy"> (inline <script> blocks allowed by sha256 hash, never 'unsafe-inline').
// A meta CSP cannot carry frame-ancestors, so the same policy plus `frame-ancestors 'none'` is also written to
// out/_headers for header-capable hosts (Netlify, Cloudflare Pages). The Supabase origin comes only from
// NEXT_PUBLIC_SUPABASE_URL: there is no hard-coded fallback. Run after `next build` (chained in postbuild).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

let supa = '';
let supaWs = '';
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    supa = u.origin;
    // Browsers do not reliably treat https://host as allowing wss://host for WebSockets.
    // Realtime needs an explicit wss (or ws) origin or the control panel stays "online, no data".
    const wsProto = u.protocol === 'https:' ? 'wss:' : u.protocol === 'http:' ? 'ws:' : '';
    if (wsProto) supaWs = `${wsProto}//${u.host}`;
  }
} catch { /* invalid → none */ }
const connectSupa = [supa, supaWs].filter(Boolean).join(' ');

// The Basis (KTX2) transcoder is an Emscripten/embind build: its worker builds invokers with new Function(), and a
// blob worker inherits the page's CSP. So the home page (the only page that decodes KTX2: clouds, HDRI) also allows
// 'unsafe-eval'; every other page (login, control, contact, subpages) stays strict.
const EVAL_PAGES = new Set(['/']);
const base = (scriptSrc, route = '') => [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval'${EVAL_PAGES.has(route) ? " 'unsafe-eval'" : ''}${scriptSrc}`, // wasm: Draco/Basis decoders
  "style-src 'self' 'unsafe-inline'",
  // Poster / file media may live on Supabase Storage or YouTube/Vimeo CDNs when site_videos is published.
  `img-src 'self' data: blob:${supa ? ' ' + supa : ''} https://i.ytimg.com https://i.vimeocdn.com`,
  `media-src 'self' blob:${supa ? ' ' + supa : ''}`,
  "font-src 'self'",
  `connect-src 'self' data: blob:${connectSupa ? ' ' + connectSupa : ''}`,
  "worker-src 'self' blob:",
  // Drive preview embeds for the simulation carousel (plus YouTube/Vimeo for site_videos).
  'frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://drive.google.com https://docs.google.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
let n = 0;
const headers = [];
for (const file of walk('out')) {
  let html = readFileSync(file, 'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, '');
  const hashes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
  }
  const src = hashes.size ? ' ' + [...hashes].join(' ') : '';
  if (!html.includes('<head>')) { console.log(`FAIL  ${file}: no <head>`); process.exit(1); }
  const route = ('/' + relative('out', file).split(sep).join('/')).replace(/index\.html$/, '');
  html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${base(src, route).join('; ')}">`);
  writeFileSync(file, html);
  headers.push(`${route}\n  Content-Security-Policy: ${[...base(src, route), "frame-ancestors 'none'"].join('; ')}\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin`);
  n++;
}
writeFileSync(join('out', '_headers'), headers.join('\n') + '\n');
console.log(`ok    CSP meta on ${n} pages; out/_headers with frame-ancestors 'none'${connectSupa ? `; connect-src + ${connectSupa}` : '; no Supabase origin (env unset)'}`);
