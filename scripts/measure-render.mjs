// Draw calls + shadow-map redraws across the journey (p 0..1, high + low tier), HEAD requests, and a p0.8 cloud shot.
// Usage: npm run build && node scripts/measure-render.mjs   (serves out/ on :4175; CHROME_PATH optional)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = 4175;
const server = spawn(process.execPath, ['node_modules/serve/build/main.js', 'out', '-l', String(PORT)], { stdio: 'ignore' });
await wait(1500);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
mkdirSync('shots/r5', { recursive: true });
const seek = (pg, p) => pg.evaluate((p) => {
  const j = document.getElementById('journey'), i = document.getElementById('info');
  const a = j.getBoundingClientRect().top + scrollY, b = i.getBoundingClientRect().top + scrollY - innerHeight * 0.35;
  window.scrollTo(0, a + p * (b - a));
}, p);
const stats = (pg) => pg.evaluate(() => ({ ...(window.__r3fStats || {}), p: window.__S?.p }));
const out = {};
// CDP capture: Playwright's screenshot waits for a stable frame, which software GL at ~1 fps rarely gives.
const shot = async (pg, path) => { const c = await pg.context().newCDPSession(pg); const { data } = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(data, 'base64')); };
try {
  for (const tier of ['high', 'low']) {
    const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    pg.setDefaultTimeout(180000);
    const heads = [];
    pg.on('request', (r) => { if (r.method() === 'HEAD') heads.push(r.url()); });
    await pg.goto(`http://localhost:${PORT}/?tier=${tier}&debug=1&capture=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pg.waitForFunction(() => window.__r3fStats, null, { timeout: 120000 });
    await wait(8000);
    const rows = [];
    for (let k = 0; k <= 20; k++) {
      const p = k / 20;
      await seek(pg, p); await wait(2500);
      const a = await stats(pg); await wait(1500); const b = await stats(pg);
      rows.push({ p, calls: b.calls, tris: b.triangles, framesIn1500ms: b.frames - a.frames, shadowRedrawsIn1500ms: b.shadowPasses - a.shadowPasses });
      if (tier === 'high' && k === 16) {
        await wait(25000); // KTX2 transcode under software GL
        rows[rows.length - 1].cloudVolumeVisible = await pg.evaluate(() => { let v = false; window.__scene.traverse((x) => { if (x.name === 'cloud_volume') v = x.visible; }); return v; });
        await shot(pg, 'shots/r5/clouds-p0.80-1440.png');
      }
    }
    if (tier === 'high') { await seek(pg, 0.15); await wait(3000); await shot(pg, 'shots/r5/floor-p0.15-1440.png'); }
    out[tier] = { maxCalls: Math.max(...rows.map((r) => r.calls || 0)), rows, heads };
    await pg.close();
  }
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); server.kill(); }
