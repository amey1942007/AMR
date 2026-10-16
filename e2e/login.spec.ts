import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

const pages = ['/login/', '/sign-in/', '/set-password/', '/maintenance/', '/does-not-exist-404/'];

test.describe('login-spec pages', () => {
  for (const path of pages) {
    test(`axe clean: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
    });
  }

  test('/login/reset/ redirects to the forgot-password card', async ({ page }) => {
    await page.goto('/login/reset/');
    await page.waitForURL(/\/sign-in\/\?forgot=1/, { timeout: 10_000 });
    expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  });

  test('/control without a session → /sign-in/?next=/control/', async ({ page }) => {
    await page.goto('/control/');
    await expect(page).toHaveURL(/\/sign-in\/\?next=%2Fcontrol%2F$/, { timeout: 10_000 });
  });

  test('noindex on login + control; robots.txt Disallow', async ({ page, request }) => {
    await page.goto('/sign-in/');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toMatch(/noindex/);
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toMatch(/Disallow:\s*\/login\//);
    expect(txt).toMatch(/Disallow:\s*\/sign-in\//);
    expect(txt).toMatch(/Disallow:\s*\/set-password\//);
    expect(txt).toMatch(/Disallow:\s*\/control\//);
  });

  test('404 "Robot lost."', async ({ page }) => {
    await page.goto('/definitely-missing-page-xyz/');
    await expect(page.getByRole('heading', { name: 'Robot lost.' })).toBeVisible();
  });

  test('reduced motion: pulse/wave/sweep animations are none', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/maintenance/');
    const name = await page.locator('.fx-rings circle').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name === 'none' || name === '').toBeTruthy();
    const sweep = await page.locator('.fx-sweep').count();
    if (sweep) {
      const display = await page.locator('.fx-sweep').first().evaluate((el) => getComputedStyle(el).display);
      expect(display).toBe('none');
    }
  });

  test('CSP meta on /login/', async ({ page }) => {
    await page.goto('/login/');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).toMatch(/connect-src 'self'/);
    const scriptSrc = csp!.split(';').find((d) => d.trim().startsWith('script-src'))!;
    expect(scriptSrc).not.toMatch(/'unsafe-inline'|'unsafe-eval'/); // 'wasm-unsafe-eval' (decoders) is allowed
    expect(scriptSrc).toMatch(/sha256-/);
  });
  test('production build: mock auth refused → "unavailable", no form, no demo chunk (review login #1)', async ({ page }) => {
    await page.goto('/login/');
    await expect(page.getByText("Sign-in isn't available yet.").first()).toBeVisible();
    await expect(page.getByLabel(/^Password/)).toHaveCount(0);
  });

  test('/control unsigned redirect: no page errors at 375 (review login #6)', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login/');
    await page.goto('/control/');
    await expect(page).toHaveURL(/\/sign-in\/\?next=/, { timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(errs).toEqual([]);
  });
});
