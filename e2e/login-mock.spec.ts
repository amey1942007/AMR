import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Runs against `next dev` (project dev-mock): the mock auth adapter only exists outside production builds.
const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('login mock adapter (dev)', () => {
  test('login form: name then password; invalid → generic error; mock ok → redirect', async ({ page }) => {
    await page.goto('/login/?next=/control/');
    await page.getByLabel('Name').fill('nobody');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText("That name isn't on the allowlist.")).toBeVisible();

    await page.getByLabel('Name').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: /Hi, Demo/i })).toBeVisible();

    await page.getByLabel(/^Password/).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#signin-pass-err')).toHaveText('⚠ Name or password is incorrect.');

    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Home/i })).toBeVisible();
    expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  });

  test('mock states: locked → rate limited, network → retry message; no password in storage/console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));
    await page.goto('/login/?mock=locked');
    await page.getByLabel('Name').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Too many attempts. Try again in a minute.')).toBeVisible();
    await page.goto('/login/?mock=network');
    await page.getByLabel('Name').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText("Can't reach the server. Check your connection.").first()).toBeVisible();
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain('demo-password');
    expect(logs.join('\n')).not.toContain('demo-password');
    expect(page.url()).not.toContain('demo-password');
  });

  test('open-redirect: //evil.com → /control/', async ({ page }) => {
    await page.goto('/login/?next=' + encodeURIComponent('//evil.com'));
    await page.getByLabel('Name').fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/evil/);
  });

  test('no forgot-password button; shows admin emails', async ({ page }) => {
    await page.goto('/sign-in/');
    await expect(page.getByRole('button', { name: /Forgot password/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'amey@amrslam.tech' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'admin@amrslam.tech' })).toBeVisible();
  });
});
