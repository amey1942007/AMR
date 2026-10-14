import { test, expect } from '@playwright/test';
// Review login #4: every page carries a CSP meta (frame-ancestors via out/_headers); real flows raise zero violations.
test.use({ bypassCSP: false });
const listen = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    (window as unknown as { __cspv: string[] }).__cspv = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __cspv: string[] }).__cspv.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
};
const violations = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __cspv: string[] }).__cspv);

for (const path of ['/', '/robots/amr4/', '/login/', '/contact/', '/maintenance/', '/does-not-exist-404/']) {
  test(`CSP meta present and no violations: ${path}`, async ({ page }) => {
    test.slow();
    await listen(page);
    await page.goto(path);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).not.toMatch(/supabase\.co/); // no hard-coded origin: derived from NEXT_PUBLIC_SUPABASE_URL only
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(4000);
    expect(await violations(page)).toEqual([]);
  });
}
