import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Runs against `next dev` (project dev-mock): the mock auth adapter only exists outside production builds.
const serious = (r: { violations: { impact?: string | null; id: string }[] }) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

async function continueAs(page: import('@playwright/test').Page, username: string) {
  await page.getByLabel(/^Username/).fill(username);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.describe('login mock adapter (dev)', () => {
  test('login form: invalid → generic error; mock ok → redirect', async ({ page }) => {
    await page.goto('/login/?next=/control/');
    await continueAs(page, 'nobody');
    await expect(page.locator('#login-username-err')).toHaveText('This username is not authorised.');

    await page.getByLabel(/^Username/).fill('demo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/Signed in as/)).toBeVisible();
    await page.getByLabel(/^Password/).fill('nope-nope');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#login-password-err')).toHaveText('Username or password is incorrect.');
    await expect(page.getByRole('alert').first()).toBeVisible();
    // Password cleared.
    await expect(page.getByLabel(/^Password/)).toHaveValue('');

    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /^Control$/ })).toBeVisible();
    // axe on the signed-in /control panel.
    expect(serious(await new AxeBuilder({ page }).analyze())).toEqual([]);
  });
  test('mock states: locked → rate limited, network → retry message; no password in storage/console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => logs.push(m.text()));
    await page.goto('/login/?mock=locked');
    await continueAs(page, 'demo');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/Too many attempts\. Try again in 5 minutes\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await page.goto('/login/?mock=network');
    await continueAs(page, 'demo');
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
    await continueAs(page, 'demo');
    await page.getByLabel(/^Password/).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/control\/$/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/evil/);
  });
});
