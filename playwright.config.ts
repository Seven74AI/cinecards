import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Story 6.8: end-to-end duel with two browsers against a real server.
 * Ports are configurable so several worktrees can run the suite at the same time without sharing servers:
 * E2E_SERVER_PORT (default 2567) and E2E_CLIENT_PORT (default 5174).
 */
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 2567);
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 5174);
// story 8.1: the e2e server keeps its accounts in a throwaway folder (set once, so workers see the same value)
process.env.E2E_DATA_DIR ??= join(tmpdir(), `cinecards-e2e-${serverPort}-${Date.now()}`);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${clientPort}`, channel: process.env.PW_CHANNEL ?? 'chrome', viewport: { width: 390, height: 844 } },
  webServer: [
    {
      command: 'pnpm --filter @cinecards/server start',
      env: { PORT: String(serverPort), DATA_DIR: process.env.E2E_DATA_DIR },
      url: `http://localhost:${serverPort}/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: `pnpm --filter @cinecards/client exec vite --port ${clientPort} --strictPort`,
      env: { VITE_SERVER_URL: `ws://localhost:${serverPort}` },
      url: `http://localhost:${clientPort}`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
