// Subpage budgets (pages-spec §11.3, §1): for each subpage in out/, the <script src> chunks must (a) stay ≤ 180 KB gz
// (project initial-JS budget) AND add ≤ 10 KB gz over the shared shell baseline (/credits stub). The spec's 120 KB
// figure is not reachable from page code: the shared AppShell (Next runtime + React + TopBar/services) is ~144 KB alone,
// (b) contain no three.js / R3F (WebGL only via the lazily imported model-viewer on the robot pages), and (c) never
// contain the mermaid runtime. Run after `next build` (chained in postbuild).
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const PAGES = ['robots', 'robots/hardware-bot', 'robots/amr4', 'technology', 'about', 'contact', 'privacy'];
// login-spec §1.10: auth pages ≤ shell + 6 KB gz (form logic); utility pages ≤ shell + 4 KB (§2). supabase-js never initial.
const UTIL = { 'login': 6, 'login/reset': 6, 'control': 6, 'maintenance': 4, '404.html': 4 };
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
let fail = false;
const scripts = (page) => [...new Set([...page.matchAll(/<script([^>]*)\ssrc="([^"]+\.js)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))];
const gz = (s) => gzipSync(readFileSync(join('out', s.slice(base.length)))).length;
const baseline = scripts(readFileSync(join('out', 'credits', 'index.html'), 'utf8')).reduce((a, s) => a + gz(s), 0);
console.log(`info  shell baseline (/credits/) ${(baseline / 1024).toFixed(1)} KB gz`);
for (const p of PAGES) {
  const html = join('out', p, 'index.html');
  if (!existsSync(html)) { console.log(`FAIL  ${html} missing`); fail = true; continue; }
  const page = readFileSync(html, 'utf8');
  const srcs = [...new Set([...page.matchAll(/<script([^>]*)\ssrc="([^"]+\.js)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))];
  let total = 0, three = false, mermaid = false;
  for (const s of srcs) {
    const buf = readFileSync(join('out', s.slice(base.length)));
    total += gzipSync(buf).length;
    const t = buf.toString('utf8');
    if (t.includes('WebGLRenderer') || t.includes('@react-three')) three = true;
    if (/mermaidAPI|flowchart-v2|securityLevel/.test(t)) mermaid = true;
  }
  const ok = total <= 180 * 1024 && total - baseline <= 10 * 1024 && !three && !mermaid;
  fail ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  /${p}/ initial JS gz ${(total / 1024).toFixed(1)} KB / 180 KB (+${((total - baseline) / 1024).toFixed(1)} KB over shell, max 10)${three ? ' · 3D IN INITIAL BUNDLE' : ''}${mermaid ? ' · MERMAID RUNTIME' : ''}`);
}
for (const [p, max] of Object.entries(UTIL)) {
  const html = p.endsWith('.html') ? join('out', p) : join('out', p, 'index.html');
  if (!existsSync(html)) { console.log(`FAIL  ${html} missing`); fail = true; continue; }
  let total = 0, three = false, supa = false;
  for (const s of scripts(readFileSync(html, 'utf8'))) {
    const buf = readFileSync(join('out', s.slice(base.length)));
    total += gzipSync(buf).length;
    const t = buf.toString('utf8');
    if (t.includes('WebGLRenderer') || t.includes('@react-three')) three = true;
    if (t.includes('signInWithPassword') || t.includes('GoTrueClient')) supa = true;
  }
  const ok = total - baseline <= max * 1024 && !three && !supa;
  fail ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  /${p} initial JS gz ${(total / 1024).toFixed(1)} KB (+${((total - baseline) / 1024).toFixed(1)} KB over shell, max ${max})${three ? ' · 3D' : ''}${supa ? ' · SUPABASE-JS IN INITIAL BUNDLE' : ''}`);
}
process.exit(fail ? 1 : 0);
