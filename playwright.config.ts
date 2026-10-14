import { defineConfig } from '@playwright/test';
// Project "static" serves the production export (`npm run build` first). Project "dev-mock" runs the login tests that
// need the mock auth adapter, which production builds refuse, against `next dev` on :3000 (the normal dev server; reused if already running).
// Playwright's waitForFunction evaluates strings, which our CSP (correctly) blocks, so the static project bypasses CSP;
// e2e/csp.spec.ts re-enables it and asserts zero CSP violations on real flows.
// Set CHROME_PATH to use a system Chrome instead of `npx playwright install`.
const launchOptions = process.env.CHROME_PATH
  ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }
  : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  projects: [
    { name: 'static', testIgnore: /login-mock\.spec/, use: { baseURL: 'http://localhost:4173', launchOptions, bypassCSP: true } },
    { name: 'dev-mock', testMatch: /login-mock\.spec/, timeout: 90_000, use: { baseURL: 'http://localhost:3000', launchOptions } },
  ],
  webServer: [
    { command: 'npx serve out -l 4173', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npx next dev -p 3000', url: 'http://localhost:3000/login/', reuseExistingServer: true, timeout: 120_000 },
  ],
});
