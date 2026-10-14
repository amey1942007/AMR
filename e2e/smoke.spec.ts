import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test('home: loads, scrolls to bottom, drawer + menu work, no console errors, axe clean', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/WebGL|GPU|404/.test(m.text()) && errors.push(m.text()));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/AMR/);
  expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);

  // Menu: focus lands on the first nav link; Esc returns focus to the menu button.
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#menu-overlay nav a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();

  // Drawer open/close.
  await page.getByRole('button', { name: 'Contact us' }).first().click();
  await expect(page.locator('#contact-drawer')).not.toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('#contact-drawer')).toHaveAttribute('inert', '');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await expect(page.getByRole('heading', { name: 'Meet the robots' })).toBeVisible();
  await expect(page.getByText('In development').first()).toBeVisible();
  expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  expect(errors).toEqual([]);
});

test('reduced motion renders the stills story', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByText('Beyond the room.').first()).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await ctx.close();
});

for (const path of ['/privacy/', '/credits/', '/robots/amr4/']) {
  test(`${path} has canonical + passes axe`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path}$`));
    expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  });
}
