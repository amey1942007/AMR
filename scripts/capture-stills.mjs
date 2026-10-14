// Captures poster, stills s1–s5, the OG image and the static minimap from OUR OWN scene (own work).
// Usage: npm run build && npm run capture:stills   (CHROME_PATH=/path/to/chrome optional)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import sharp from 'sharp';

const PORT = 4174;
const server = spawn(process.execPath, ['node_modules/serve/build/main.js', 'out', '-l', String(PORT)], { stdio: 'ignore' });
await wait(1500);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const HIDE = `#site-header, div[aria-hidden][style*="z-index:10"], div[aria-hidden][style*="z-index: 10"], #info, footer, .debug-hud { visibility: hidden !important }`;
mkdirSync('public/img/stills', { recursive: true });

async function page(w, h) {
  const pg = await browser.newPage({ viewport: { width: w, height: h } });
  pg.setDefaultTimeout(180000);
  await pg.goto(`http://localhost:${PORT}/?tier=high`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 120000 });
  await wait(8000); // GLB + HDRI + compile
  return pg;
}
const seek = (pg, p) => pg.evaluate((p) => {
  const j = document.getElementById('journey'), i = document.getElementById('info');
  const a = j.getBoundingClientRect().top + scrollY, b = i.getBoundingClientRect().top + scrollY - innerHeight * 0.35;
  window.scrollTo(0, a + p * (b - a));
}, p).then(() => wait(3500));
const webp = (buf, out, w, h, q = 80) => sharp(buf).resize(w, h).webp({ quality: q }).toFile(out);

try {
  const pg = await page(1920, 1080);
  await pg.addStyleTag({ content: HIDE });
  await seek(pg, 0);
  await webp(await pg.screenshot(), 'public/img/hero-poster.webp', 1920, 1080);
  const P = [0.13, 0.34, 0.48, 0.62, 0.86];
  for (let i = 0; i < P.length; i++) {
    await seek(pg, P[i]);
    await webp(await pg.screenshot(), `public/img/stills/s${i + 1}.webp`, 1920, 1080, 72);
  }
  await seek(pg, 0.34);
  await sharp(await pg.screenshot()).resize(1200, 630).png({ compressionLevel: 9, palette: true }).toFile('public/og.png');
  await pg.close();

  const pm = await page(1440, 900);
  await seek(pm, 0.8);
  await webp(await pm.locator('.minimap-canvas').screenshot(), 'public/img/map-static.webp', 480, 336, 85);
  console.log('captured: hero-poster, stills s1–s5, og.png, map-static');
} finally {
  await browser.close();
  server.kill();
}
