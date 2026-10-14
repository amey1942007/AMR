import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
const PAGES = [
  { path: '/robots/', h1: 'Two robots, one mapping stack.', crumbs: ['Home', 'Robots'], figs: 2 },
  { path: '/robots/hardware-bot/', h1: 'Hardware Bot', crumbs: ['Home', 'Robots', 'Hardware Bot'], figs: 4 },
  { path: '/robots/amr4/', h1: 'AMR4', crumbs: ['Home', 'Robots', 'AMR4'], figs: 4 },
  { path: '/technology/', h1: 'How our robots see, map and move.', crumbs: ['Home', 'Technology'], figs: 8 },
  { path: '/about/', h1: 'We build robots that understand rooms.', crumbs: ['Home', 'About'], figs: 1 },
  { path: '/contact/', h1: "Let's talk.", crumbs: ['Home', 'Contact'], figs: 1 },
  { path: '/privacy/', h1: 'Privacy policy', crumbs: ['Home', 'Privacy'], figs: 1 },
];

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/WebGL|GPU/.test(m.text()) && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

for (const p of PAGES) {
  test(`${p.path}: paper layout, figures, canonical, no 3D bundle, axe clean`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(p.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${p.path}$`));
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('listitem')).toHaveText(p.crumbs.map((c) => new RegExp(c)));
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText(p.crumbs.at(-1)!);
    // Every figure: number + caption + explainer + source chip.
    const figs = page.locator('main figure');
    await expect(figs).toHaveCount(p.figs);
    for (let i = 0; i < p.figs; i++) {
      const cap = figs.nth(i).locator('figcaption');
      await expect(cap.locator('strong')).toHaveText(`Fig. ${i + 1}`);
      expect((await cap.locator('p').nth(1).innerText()).split(/\s+/).length).toBeGreaterThan(5);
    }
    // No public "View code" links while the repo is private; no mermaid runtime; no WebGL canvas in the page.
    await expect(page.getByRole('link', { name: /view code/i })).toHaveCount(0);
    expect(await page.evaluate(() => 'mermaid' in window)).toBe(false);
    // model-viewer's canvas lives in its shadow root (robot pages only); the page itself has none.
    expect(await page.evaluate(() => document.querySelectorAll('canvas').length)).toBe(0);
    await page.keyboard.press('End');
    await page.waitForTimeout(900);
    expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
    // Jump-to-end leaves no block stuck hidden.
    expect(await page.locator('.reveal-wait').count()).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('charts carry a data table; AMR4 page never shows Hardware Bot features', async ({ page }) => {
  await page.goto('/technology/');
  const summaries = page.getByText('Show data table');
  expect(await summaries.count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('not stated in branch').first()).toBeAttached();
  await page.goto('/robots/amr4/');
  const main = await page.locator('main').innerText();
  for (const w of ['slam_toolbox', 'Nav2', 'YOLO', 'dashboard', 'frontier', 'Roadmap']) expect(main).not.toContain(w);
  await expect(page.getByText('IN DEVELOPMENT').first()).toBeVisible();
});

test('robot viewer lazy-loads model-viewer only (AMR4)', async ({ page }) => {
  const js: string[] = [];
  page.on('response', async (r) => { if (r.url().endsWith('.js')) js.push(await r.text().catch(() => '')); });
  await page.goto('/robots/amr4/');
  await expect(page.getByRole('group', { name: '3D model of AMR4, use arrow keys to rotate' })).toBeAttached({ timeout: 20000 });
  expect(js.some((t) => t.includes('@react-three'))).toBe(false);
});

test('reduced motion: viewer stays a poster, sweep static', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/robots/amr4/');
  await page.waitForTimeout(800);
  await expect(page.locator('model-viewer')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'AMR4, schematic placeholder' })).toBeVisible();
  await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  await ctx.close();
});

test('/robots at 375 px: one compare table per robot, never interleaved', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('/robots/');
  await page.keyboard.press('End');
  await page.waitForTimeout(900);
  const visible = page.locator('#fig-robots-1 table:visible');
  await expect(visible).toHaveCount(2);
  for (const [i, id] of ['hardware', 'amr4'].entries()) {
    const robots = await visible.nth(i).locator('[data-robot]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-robot')))]);
    expect(robots).toEqual([id]);
  }
  expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  await ctx.close();
});

test('/contact: error summary, topic required, success focus', async ({ page }) => {
  await page.goto('/contact/');
  const submit = page.getByRole('button', { name: /Send message|Open email app/ });
  await submit.click();
  const alert = page.locator('form [role="alert"]');
  await expect(alert).toContainText('Topic: Choose a topic.');
  await expect(alert).toBeFocused();
  await expect(page.locator('#cf-name')).toHaveAttribute('aria-invalid', 'true');
  await page.fill('#cf-name', 'Asha');
  await page.fill('#cf-email', 'asha@example.com');
  await page.selectOption('#cf-topic', 'Partnership');
  await page.fill('#cf-message', 'Hello from the e2e test');
  await page.evaluate(() => { (window as unknown as { __nav?: string }).__nav = ''; });
  await submit.click();
  const done = page.getByRole('heading', { level: 2, name: /Thanks, Asha|email app should open/ });
  await expect(done).toBeVisible();
  await expect(done).toBeFocused();
  expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
});

test('/privacy: draft banner and print hides nav/footer', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.getByRole('note', { name: 'Legal status' })).toContainText('Draft: under legal review. Last updated 14 October 2026.');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#site-header')).toBeHidden();
  await expect(page.locator('footer')).toBeHidden();
});

// ── Review HIGH items: h1 never splits mid-word, SVG text ≥ 12 px, no axe scrollable-region / serious issues ──
const WIDTHS = [375, 768, 1024, 1440];
for (const w of WIDTHS) {
  test(`all subpages at ${w}px: h1 unbroken, SVG text >= 12px, axe clean`, async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const p of PAGES) {
      await page.goto(p.path);
      // h1: every word renders on one line box (a word split across lines has > 1 client rect).
      const broken = await page.locator('h1').evaluate((h) => {
        const out: string[] = [];
        const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n.textContent ?? '';
          for (const m of t.matchAll(/\S+/g)) {
            const r = document.createRange(); r.setStart(n, m.index!); r.setEnd(n, m.index! + m[0].length);
            const tops = new Set([...r.getClientRects()].map((c) => Math.round(c.top)));
            if (tops.size > 1) out.push(m[0]);
          }
        }
        return out;
      });
      expect(broken, `${p.path} h1 words split at ${w}px`).toEqual([]);
      // Rendered SVG text size = computed font-size × the SVG's screen scale. Only visible text counts.
      const small = await page.evaluate(() => [...document.querySelectorAll<SVGTextElement>('main svg text')]
        .filter((t) => t.getClientRects().length > 0 && (t.textContent ?? '').trim() && getComputedStyle(t).display !== 'none' && getComputedStyle(t).visibility !== 'hidden')
        .map((t) => ({ text: (t.textContent ?? '').trim().slice(0, 30), px: parseFloat(getComputedStyle(t).fontSize) * Math.hypot(t.getScreenCTM()?.a ?? 1, t.getScreenCTM()?.b ?? 0) }))
        .filter((x) => x.px < 11.95));
      expect(small, `${p.path} SVG text below 12px at ${w}px`).toEqual([]);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.id === 'scrollable-region-focusable'), `${p.path} scrollable region at ${w}px`).toEqual([]);
      expect(serious(axe), `${p.path} axe at ${w}px`).toEqual([]);
    }
    await ctx.close();
  });
}

test('every figure SVG has <title> and <desc>', async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p.path);
    const missing = await page.evaluate(() => [...document.querySelectorAll('main figure svg[role="img"]')]
      .filter((s) => !s.querySelector(':scope > title') || !s.querySelector(':scope > desc')).length);
    expect(missing, p.path).toBe(0);
  }
});

test('skip link says "Skip to content" on subpages; TOC resets at top', async ({ page }) => {
  await page.goto('/technology/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await expect(page.getByRole('navigation', { name: 'On this page' }).locator('[aria-current="true"]')).toContainText('ROS 2');
});
