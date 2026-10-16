import { test, expect } from '@playwright/test';

test('menu close stays mounted through the exit, then unmounts', async ({ page }) => {
  await page.goto('/privacy/');
  const openBtn = page.getByRole('button', { name: 'Open menu' });
  await openBtn.click();
  const overlay = page.locator('#menu-overlay');
  await expect(overlay).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#menu-overlay nav a').first()).toBeFocused();
  await expect.poll(() => overlay.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.95);

  await page.getByRole('dialog', { name: 'Site menu' }).getByRole('button', { name: 'Close menu' }).click();
  await expect(openBtn).toBeFocused();
  await expect(openBtn).toHaveAttribute('aria-expanded', 'false');
  await expect(overlay).toHaveAttribute('data-closing', 'true');
  await expect(overlay).toHaveAttribute('inert', '');
  await expect(overlay).not.toHaveAttribute('data-open', 'true');
  // Let the exit transition start before reading computed style (a same-frame flush reports the end value).
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
  }));
  const exiting = await overlay.evaluate((el) => {
    const cs = getComputedStyle(el);
    const line = el.querySelector('.menu-line');
    return {
      visibility: cs.visibility,
      opacity: Number(cs.opacity),
      duration: cs.transitionDuration,
      lineDuration: line ? getComputedStyle(line).transitionDuration : '0s',
    };
  });
  expect(exiting.visibility).toBe('visible');
  expect(exiting.opacity).toBeGreaterThan(0.4);
  // Panel fade is the full exit (~900ms), not the inert rule's instant hide. Lines keep a transform transition.
  expect(parseFloat(exiting.duration)).toBeGreaterThan(0.5);
  expect(parseFloat(exiting.lineDuration)).toBeGreaterThan(0);

  await expect(overlay).toHaveCount(0, { timeout: 2500 });

  // Escape still closes, and a second open is not stuck in the exit.
  await openBtn.click();
  await expect(overlay).toHaveAttribute('data-open', 'true');
  await page.keyboard.press('Escape');
  await expect(openBtn).toBeFocused();
  await expect(overlay).toHaveAttribute('data-closing', 'true');
  await expect(overlay).toHaveCount(0, { timeout: 2500 });
});

test('reduced motion closes the menu immediately', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/privacy/');
  const openBtn = page.getByRole('button', { name: 'Open menu' });
  await openBtn.click();
  const overlay = page.locator('#menu-overlay');
  await expect(page.locator('#menu-overlay nav a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(openBtn).toBeFocused();
  await expect(openBtn).toHaveAttribute('aria-expanded', 'false');
  await expect(overlay).toHaveCount(0, { timeout: 400 });
  await ctx.close();
});
