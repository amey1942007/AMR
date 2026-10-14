import { defineConfig } from '@playwright/test';
// Serves the static export (`npm run build` first). Set CHROME_PATH to use a system Chrome instead of `npx playwright install`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'npx serve out -l 4173', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
});
