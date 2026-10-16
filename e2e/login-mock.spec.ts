import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Runs against `next dev` (project dev-mock): the mock auth adapter only exists outside production builds.
const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('login mock adapter (dev)', () => {
  test('login form: invalid → generic error; mock ok → redirect', async ({ page }) => {
    await page.goto('/login/?next=/control/');
    await page.getByLabel('Email').fill('nobody@amrslam.tech');
    await page.getByLabel(/^Password/).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#signin-pass-err')).toHaveText('⚠ Email or password is incorrect.');
    await expect(page.getByLabel('Email')).toHaveValue('nobody@amrslam.tech');

    await page.getByLabel('Email').fill('demo@amrslam.tech');
    await page.getByLabel(/^Password/).fill('nope-nope');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#signin-pass-err')).toHaveText('⚠ Email or password is incorrect.');
    await expect(page.getByLabel(/^Password/)).toHaveValue('nope-nope');

    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /AMR4/ })).toBeVisible();
    expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  });

  test('mock states: locked → rate limited, network → retry message; no password in storage/console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));
    await page.goto('/login/?mock=locked');
    await page.getByLabel('Email').fill('demo@amrslam.tech');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Too many attempts. Try again in a minute.')).toBeVisible();
    await page.goto('/login/?mock=network');
    await page.getByLabel('Email').fill('demo@amrslam.tech');
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
    await page.getByLabel('Email').fill('demo@amrslam.tech');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/evil/);
  });
});
