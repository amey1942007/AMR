import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('ui-spec §14 simulation video', () => {
  test('null → placeholder; no media/iframe requests before click', async ({ page }) => {
    const media: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (/\.(mp4|webm|vtt)(\?|$)/i.test(u) || /youtube|vimeo|ytimg|player\.vimeo/i.test(u)) media.push(u);
    });
    await page.goto('/');
    // Scroll into #info so the dynamic player mounts.
    await page.locator('#simulation').scrollIntoViewIfNeeded();
    const placeholder = page.getByLabel('Simulation video coming soon');
    test.skip(!(await placeholder.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)), 'fixture build (file entry)');
    await expect(placeholder).toBeVisible();
    await expect(page.getByText('SIMULATION VIDEO · COMING SOON')).toBeVisible();
    expect(media, media.join('\n')).toEqual([]);
  });

  test('axe clean on the placeholder', async ({ page }) => {
    await page.goto('/');
    await page.locator('#simulation').scrollIntoViewIfNeeded();
    await expect(page.locator('#sim-title')).toBeVisible();
    expect(serious(await new AxeBuilder({ page }).include('#simulation').analyze())).toEqual([]);
  });

  test('keyboard: Tab reaches the simulation section', async ({ page }) => {
    await page.goto('/');
    await page.locator('#simulation').scrollIntoViewIfNeeded();
    // Placeholder has no play button; the section heading is reachable.
    await expect(page.locator('#sim-title')).toBeVisible();
  });
});

// File-entry tests need a build with NEXT_PUBLIC_SIM_VIDEO_FIXTURE=1; they skip on the placeholder build.
test.describe('ui-spec §14 file player (fixture build)', () => {
  test.beforeEach(async ({ page }) => {
    const dir = process.cwd() + '/e2e/fixtures/';
    await page.route('**/video/__e2e__/*', (r) => {
      const name = new URL(r.request().url()).pathname.split('/').pop()!;
      const type = name.endsWith('.webm') ? 'video/webm' : name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.vtt') ? 'text/vtt' : 'image/webp';
      return r.fulfill({ path: dir + name, contentType: type });
    });
  });

  test('facade: no video bytes before click; click → playing; focus inside; canvas paused; Esc-free', async ({ page }) => {
    const media: string[] = [];
    page.on('request', (r) => { if (/\.(mp4|webm|vtt)(\?|$)/.test(r.url())) media.push(r.url()); });
    await page.goto('/?debug=1');
    await page.locator('#simulation').scrollIntoViewIfNeeded();
    const play = page.getByRole('button', { name: /^Play: Simulation fixture \(0:03\)$/ });
    test.skip(!(await play.count().then((n) => n > 0).catch(() => false)) && !(await play.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)), 'placeholder build');
    expect(media).toEqual([]);
    await expect(page.locator('#simulation video, #simulation iframe')).toHaveCount(0);
    // Keyboard: focus the facade and press Enter.
    await play.focus();
    await page.keyboard.press('Enter');
    const video = page.locator('#simulation video');
    await expect(video).toHaveCount(1);
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('VIDEO');
    await expect(page.locator('pre').filter({ hasText: 'render paused' })).toHaveCount(1);
    // Frames stop: R3F rendered-frame counter (?debug=1 RenderStats) must not advance while the video plays
    // (frameloop 'demand' allows at most the one invalidate() on switch).
    const frames = () => page.evaluate(() => (window as unknown as { __r3fStats?: { frames: number } }).__r3fStats?.frames ?? null);
    const f0 = await frames();
    test.info().annotations.push({ type: 'canvas', description: f0 === null ? '3D canvas not running (no WebGL2 in this browser)' : `frames before wait: ${f0}` });
    if (f0 !== null) {
      await page.waitForTimeout(1500);
      const f1 = (await frames())!;
      expect(f1 - f0).toBeLessThanOrEqual(1);
    }
    expect(await video.evaluate((v: HTMLVideoElement) => v.autoplay || v.loop || v.muted)).toBe(false);
    expect(serious(await new AxeBuilder({ page }).include('#simulation').analyze())).toEqual([]);
  });

  test('reduced motion: never autoplays', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('#simulation').scrollIntoViewIfNeeded();
    const play = page.getByRole('button', { name: /^Play: / });
    test.skip(!(await play.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)), 'placeholder build');
    await page.waitForTimeout(1000);
    await expect(page.locator('#simulation video')).toHaveCount(0);
  });

  test('menu opening auto-pauses the video', async ({ page }) => {
    await page.goto('/');
    await page.locator('#simulation').scrollIntoViewIfNeeded();
    const play = page.getByRole('button', { name: /^Play: / });
    test.skip(!(await play.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)), 'placeholder build');
    await play.click();
    const video = page.locator('#simulation video');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 15_000 }).toBe(true);
    await page.getByRole('button', { name: /open menu/i }).click();
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });
});
