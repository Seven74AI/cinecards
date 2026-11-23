import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './main.ts';

/** Story 8.7: the live smoke test (scripts/smoke.mjs), run end to end against an in-memory server. */

const SCRIPT = fileURLToPath(new URL('../../../scripts/smoke.mjs', import.meta.url));

interface SmokeResult {
  ok: boolean;
  commit: string | null;
  startedAt: string;
  durationMs: number;
  steps: { name: string; ok: boolean; ms: number; error?: string }[];
}

const STEPS = ['health', 'accounts', 'friends', 'presence', 'invite', 'duel', 'emote', 'concede', 'history', 'decks', 'constructed'];

const runSmoke = (url: string, dataDir: string, extra: Record<string, string> = {}) =>
  new Promise<{ code: number; stdout: string }>((resolve) => {
    execFile(
      process.execPath,
      ['--experimental-transform-types', '--no-warnings', SCRIPT],
      { env: { ...process.env, SMOKE_URL: url, DATA_DIR: dataDir, SMOKE_COMMIT: 'abc1234', ...extra }, timeout: 70_000 },
      (err, stdout) => resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout }),
    );
  });

describe('8.7 live smoke test', () => {
  const port = 28170 + Math.floor(Math.random() * 100);
  const base = `http://localhost:${port}`;
  const dir = mkdtempSync(join(tmpdir(), 'cinecards-smoke-'));
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    server = await startServer(port, undefined, { dataDir: ':memory:', smokeFile: join(dir, 'smoke.json') });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('passes every step twice with the same two accounts, and publishes a result without secrets at /api/smoke', async () => {
    expect((await fetch(`${base}/api/smoke`)).status).toBe(404);

    const first = await runSmoke(base, dir);
    expect(first.stdout).toMatch(/smoke OK/);
    expect(first.code).toBe(0);
    const creds = JSON.parse(readFileSync(join(dir, 'smoke-accounts.json'), 'utf8')) as { accounts: { nickname: string; password: string }[] };
    expect(creds.accounts.map((a) => a.nickname)).toEqual(['ZZ-fumee-a', 'ZZ-fumee-b']);
    expect(statSync(join(dir, 'smoke-accounts.json')).mode & 0o077).toBe(0);

    // the second run reuses the accounts, the friendship and the decks
    const second = await runSmoke(base, dir);
    expect(second.code).toBe(0);
    const res = await fetch(`${base}/api/smoke`);
    expect(res.status).toBe(200);
    const result = (await res.json()) as SmokeResult;
    expect(result).toMatchObject({ ok: true, commit: 'abc1234' });
    expect(result.steps.map((s) => s.name)).toEqual(STEPS);
    expect(result.steps.every((s) => s.ok && typeof s.ms === 'number')).toBe(true);
    expect(result.durationMs).toBeLessThan(60_000);
    expect(new Date(result.startedAt).getTime()).toBeGreaterThan(0);
    const raw = JSON.stringify(result);
    for (const a of creds.accounts) expect(raw).not.toContain(a.password);
    expect(raw).not.toMatch(/token/i);

    // no new accounts: logging in with the saved passwords still works and the two accounts are only friends together
    const login = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds.accounts[0]) });
    const { token } = (await login.json()) as { token: string };
    const friends = (await (await fetch(`${base}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { friends: { nickname: string }[]; outgoing: unknown[] };
    expect(friends.friends.map((f) => f.nickname)).toEqual(['ZZ-fumee-b']);
    expect(friends.outgoing).toEqual([]);
    const history = (await (await fetch(`${base}/api/history`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { games: { opponent: { nickname: string } }[] };
    expect(history.games).toHaveLength(4);
    expect(history.games.every((g) => g.opponent.nickname === 'ZZ-fumee-b')).toBe(true);
    const decks = (await (await fetch(`${base}/api/decks`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { decks: unknown[] };
    expect(decks.decks).toHaveLength(1);
  }, 60_000);

  it('stops at the first failing step and exits with 1', async () => {
    const other = mkdtempSync(join(tmpdir(), 'cinecards-smoke-down-'));
    try {
      const run = await runSmoke('http://localhost:1', other);
      expect(run.code).toBe(1);
      expect(run.stdout).toMatch(/smoke FAILED \(health/);
      const result = JSON.parse(readFileSync(join(other, 'smoke.json'), 'utf8')) as SmokeResult;
      expect(result.ok).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toMatchObject({ name: 'health', ok: false, error: expect.any(String) });
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  }, 30_000);
});
