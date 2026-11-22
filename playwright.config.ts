import { defineConfig } from '@playwright/test';

/** Story 6.8: end-to-end duel with two browsers against a real server. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5174', channel: process.env.PW_CHANNEL ?? 'chrome', viewport: { width: 390, height: 844 } },
  webServer: [
    { command: 'pnpm --filter @cinecards/server start', url: 'http://localhost:2567/health', reuseExistingServer: true, timeout: 30_000 },
    { command: 'pnpm --filter @cinecards/client exec vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true, timeout: 30_000 },
  ],
});
