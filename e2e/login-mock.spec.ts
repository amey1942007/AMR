import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Runs against `next dev` (project dev-mock): the mock auth adapter only exists outside production builds.
const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('login mock adapter (dev)', () => {
  test('login form: invalid → generic error; mock ok → redirect', async ({ page }) => {
    await page.goto('/login/?next=/control/');
    await page.getByLabel(/^Email/).fill('wrong@amrslam.tech');
    await page.getByLabel(/^Password/).fill('nope');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#login-password-err')).toHaveText('Email or password is incorrect.');
    await expect(page.getByRole('alert').first()).toBeVisible();
    // Password cleared.
    await expect(page.getByLabel(/^Password/)).toHaveValue('');

    await page.getByLabel(/^Email/).fill('demo@amrslam.tech');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Control panel/ })).toBeVisible();
    // axe on the signed-in /control stub (5th page).
    expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  });
  test('mock states: locked → rate limited, network → retry message; no password in storage/console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));
    await page.goto('/login/?mock=locked');
    await page.getByLabel(/^Email/).fill('demo@amrslam.tech');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/Too many attempts\. Try again in 5 minutes\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await page.goto('/login/?mock=network');
    await page.getByLabel(/^Email/).fill('demo@amrslam.tech');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText("Couldn't reach the sign-in service. Check your connection and try again.").first()).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: "Couldn't reach" })).toBeFocused(); // review login #3
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain('demo-password');
    expect(logs.join('\n')).not.toContain('demo-password');
    expect(page.url()).not.toContain('demo-password');
  });
  test('open-redirect: //evil.com → /control/', async ({ page }) => {
    await page.goto('/login/?next=' + encodeURIComponent('//evil.com'));
    // The card resolves the target on mount; sign in and assert we never leave the origin.
    await page.getByLabel(/^Email/).fill('demo@amrslam.tech');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/evil/);
  });
});
