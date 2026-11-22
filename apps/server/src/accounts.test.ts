import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@colyseus/sdk';
import type { LobbyMessage } from '@cinecards/protocol';
import { originAllowed, parseOrigins } from './api/http.ts';
import { Limiter } from './auth/limiter.ts';
import { nicknameKey, normalizeNickname, validNickname, validPassword } from './auth/nickname.ts';
import { hashPassword, verifyPassword } from './auth/password.ts';
import { AccountService } from './auth/service.ts';
import { hashRecoveryCode, newRecoveryCode, recoveryKey, sha256 } from './auth/tokens.ts';
import { backupIfDue } from './db/backup.ts';
import { MIGRATIONS, migrate, openDb, schemaVersion } from './db/db.ts';
import { SESSION_IDLE_MS } from './db/sessions.ts';
import { startServer } from './main.ts';

const DAY = 24 * 60 * 60 * 1000;
const clock = () => {
  const c = { t: Date.UTC(2026, 10, 22, 12), now: () => c.t };
  return c;
};
const service = () => {
  const c = clock();
  return { c, s: new AccountService(openDb(':memory:'), c.now) };
};
const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};

describe('8.1 nicknames and passwords', () => {
  it('normalizes and validates nicknames', () => {
    expect(normalizeNickname('  Léa   la  Brave ')).toBe('Léa la Brave');
    expect(validNickname('Léa_42-x')).toBe(true);
    expect(validNickname('ab')).toBe(false);
    expect(validNickname('a'.repeat(17))).toBe(false);
    expect(validNickname('Root!')).toBe(false);
    expect(validNickname('Zoë')).toBe(true);
    // composed and decomposed accents, and case, give the same key
    expect(nicknameKey('ÉMILE')).toBe(nicknameKey('émile'));
  });

  it('validates password length in characters', () => {
    expect(validPassword('1234567')).toBe(false);
    expect(validPassword('12345678')).toBe(true);
    expect(validPassword('x'.repeat(128))).toBe(true);
    expect(validPassword('x'.repeat(129))).toBe(false);
    expect(validPassword(12345678)).toBe(false);
  });

  it('hashes passwords with scrypt and a random salt', async () => {
    const a = await hashPassword('motdepasse');
    const b = await hashPassword('motdepasse');
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword('motdepasse', a)).toBe(true);
    expect(await verifyPassword('motdepassE', a)).toBe(false);
    expect(await verifyPassword('x', null)).toBe(false);
  });

  it('makes recovery codes without look-alikes, compared without dashes or case', () => {
    const code = newRecoveryCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
    expect(recoveryKey(code.toLowerCase().replaceAll('-', ' '))).toBe(code.replaceAll('-', ''));
    expect(hashRecoveryCode(code.toLowerCase())).toBe(hashRecoveryCode(code));
  });
});

describe('8.1 database', () => {
  it('replays migrations idempotently on an existing database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cinecards-db-'));
    try {
      const path = join(dir, 'sub', 'cinecards.db');
      const db = openDb(path);
      db.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES ('A', 'a', NULL, 'x', 1)").run();
      db.close();
      const again = openDb(path);
      migrate(again);
      expect(schemaVersion(again)).toBe(MIGRATIONS.length);
      expect((again.prepare('SELECT COUNT(*) n FROM accounts').get() as { n: number }).n).toBe(1);
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('makes one copy a day and keeps the 7 most recent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cinecards-bk-'));
    try {
      const db = openDb(join(dir, 'cinecards.db'));
      const t0 = Date.UTC(2026, 10, 1);
      for (let d = 0; d < 9; d++) expect(backupIfDue(db, dir, t0 + d * DAY)).toContain(`cinecards-2026-11-0${d + 1}.db`);
      expect(backupIfDue(db, dir, t0 + 8 * DAY + 3600_000)).toBeNull(); // same day: nothing new
      const files = readdirSync(join(dir, 'backups')).sort();
      expect(files).toHaveLength(7);
      expect(files[0]).toBe('cinecards-2026-11-03.db');
      expect(files.at(-1)).toBe('cinecards-2026-11-09.db');
      expect(backupIfDue(db, ':memory:', t0)).toBeNull();
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('8.1 account service', () => {
  it('creates an account, refuses a taken nickname regardless of case and accents', async () => {
    const { s } = service();
    const r = ok(await s.create('  Émile ', 'motdepasse'));
    expect(r.account.nickname).toBe('Émile');
    expect(r.recoveryCode).toMatch(/^[A-Z0-9]{4}-/);
    expect(s.accountOf(r.token)).toEqual(r.account);
    const taken = await s.create('ÉMILE', 'autrechose');
    expect(taken).toMatchObject({ ok: false, status: 409, error: 'nickname_taken', message: 'Ce pseudo est déjà pris.' });
    expect(await s.create('ab', 'motdepasse')).toMatchObject({ status: 400, error: 'invalid_nickname', message: '3 à 16 caractères : lettres, chiffres, espace, - et _.' });
    expect(await s.create('Valide', 'court')).toMatchObject({ status: 400, error: 'invalid_password', message: '8 caractères au moins.' });
  });

  it('never stores the password, the token or the recovery code in clear', async () => {
    const { s } = service();
    const r = ok(await s.create('Secret', 'motdepasse'));
    const dump = JSON.stringify([s.db.prepare('SELECT * FROM accounts').all(), s.db.prepare('SELECT * FROM sessions').all()]);
    expect(dump).not.toContain('motdepasse');
    expect(dump).not.toContain(r.token);
    expect(dump).not.toContain(r.recoveryCode);
    expect(dump).not.toContain(r.recoveryCode.replaceAll('-', ''));
    expect(dump).toContain(sha256(r.token));
  });

  it('logs in with any case, gives one message for any wrong pair', async () => {
    const { s } = service();
    ok(await s.create('Marla', 'motdepasse'));
    const r = ok(await s.login('marla', 'motdepasse'));
    expect(r.account.nickname).toBe('Marla');
    const wrongPw = await s.login('Marla', 'mauvais!!');
    const unknown = await s.login('Personne', 'motdepasse');
    expect(wrongPw).toEqual({ ok: false, status: 401, error: 'bad_credentials', message: 'Pseudo ou mot de passe incorrect.' });
    expect(unknown).toEqual(wrongPw);
  });

  it('refuses attempts after 10 failures in 15 min, until the window ends', async () => {
    const { s, c } = service();
    ok(await s.create('Tyler', 'motdepasse'));
    for (let i = 0; i < 10; i++) {
      expect(await s.login('Tyler', `faux${i}xxxx`)).toMatchObject({ status: 401 });
      c.t += 60_000;
    }
    // the right password is refused too while the limit holds
    const limited = await s.login('TYLER', 'motdepasse');
    expect(limited).toMatchObject({ ok: false, status: 429, error: 'too_many_attempts', message: 'Trop d’essais. Réessaie dans 5 min.' });
    expect((limited as { retryAfterSeconds: number }).retryAfterSeconds).toBe(300);
    // the recovery code shares the same limit
    expect(await s.recover('Tyler', 'AAAA-AAAA-AAAA-AAAA', 'nouveaumdp')).toMatchObject({ status: 429 });
    c.t += 5 * 60_000;
    ok(await s.login('Tyler', 'motdepasse'));
  });

  it('keeps a session 90 days after its last use, then expires it', async () => {
    const { s, c } = service();
    const r = ok(await s.create('Durden', 'motdepasse'));
    c.t += 60 * DAY;
    expect(s.accountOf(r.token)).not.toBeNull(); // used: the 90 days start again
    c.t += 89 * DAY;
    expect(s.accountOf(r.token)).not.toBeNull();
    c.t += SESSION_IDLE_MS + 1;
    expect(s.accountOf(r.token)).toBeNull();
    expect(s.accountOf('nope')).toBeNull();
    expect(s.accountOf(undefined)).toBeNull();
  });

  it('purges sessions unused for 90 days', async () => {
    const { s, c } = service();
    ok(await s.create('Bob', 'motdepasse'));
    c.t += SESSION_IDLE_MS + 1;
    expect(s.purge()).toBe(1);
  });

  it('logs out one device only', async () => {
    const { s } = service();
    const a = ok(await s.create('Paulson', 'motdepasse'));
    const b = ok(await s.login('Paulson', 'motdepasse'));
    s.logout(a.token);
    expect(s.accountOf(a.token)).toBeNull();
    expect(s.accountOf(b.token)).not.toBeNull();
  });

  it('resets the password with the recovery code, closes other sessions and issues a new code', async () => {
    const { s } = service();
    const a = ok(await s.create('Angel', 'motdepasse'));
    const other = ok(await s.login('Angel', 'motdepasse'));
    const r = ok(await s.recover('angel', a.recoveryCode.toLowerCase().replaceAll('-', ''), 'nouveaumdp'));
    expect(r.recoveryCode).not.toBe(a.recoveryCode);
    expect(s.accountOf(a.token)).toBeNull();
    expect(s.accountOf(other.token)).toBeNull();
    expect(s.accountOf(r.token)).toEqual(a.account);
    expect(await s.login('Angel', 'motdepasse')).toMatchObject({ status: 401 });
    ok(await s.login('Angel', 'nouveaumdp'));
    // the old code is spent
    expect(await s.recover('Angel', a.recoveryCode, 'encoreun!')).toMatchObject({ status: 401, error: 'bad_credentials' });
    expect(await s.recover('Angel', r.recoveryCode, 'court')).toMatchObject({ status: 400, error: 'invalid_password' });
  });

  it('limiter: a success does not clear recent failures', () => {
    let t = 0;
    const l = new Limiter(() => t, 3, 1000);
    l.fail('k');
    l.fail('k');
    expect(l.retryAfterMs('k')).toBe(0);
    t = 500;
    l.fail('k');
    expect(l.retryAfterMs('k')).toBe(500);
    t = 1001;
    expect(l.retryAfterMs('k')).toBe(0);
  });
});

describe('8.1 HTTP API and rooms', () => {
  const port = 26670 + Math.floor(Math.random() * 100);
  const base = `http://localhost:${port}`;
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    server = await startServer(port, undefined, { dataDir: ':memory:', clientOrigins: ['https://example.test'] });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('keeps /health as plain text and answers /api/health', async () => {
    expect(await (await fetch(`${base}/health`)).text()).toBe('ok');
    const r = await fetch(`${base}/api/health`);
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await r.json()).toEqual({ ok: true, accounts: true });
  });

  it('creates, reads, logs in, logs out and recovers over HTTP', async () => {
    const nick = `Api${Date.now() % 1e6}`;
    const created = await post('/api/accounts', { nickname: nick, password: 'motdepasse' });
    expect(created.status).toBe(201);
    const c = (await created.json()) as { token: string; account: { id: number; nickname: string }; recoveryCode: string };
    expect(c.account.nickname).toBe(nick);
    expect((await post('/api/accounts', { nickname: nick, password: 'motdepasse' })).status).toBe(409);
    const me = await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${c.token}` } });
    expect(await me.json()).toEqual({ account: c.account });
    expect((await fetch(`${base}/api/me`)).status).toBe(401);
    const bad = await post('/api/sessions', { nickname: nick, password: 'pasbonpasbon' });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ error: 'bad_credentials', message: 'Pseudo ou mot de passe incorrect.' });
    const login = await post('/api/sessions', { nickname: nick.toLowerCase(), password: 'motdepasse' });
    expect(login.status).toBe(200);
    const del = await fetch(`${base}/api/sessions/current`, { method: 'DELETE', headers: { Authorization: `Bearer ${c.token}` } });
    expect(del.status).toBe(204);
    expect((await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${c.token}` } })).status).toBe(401);
    const rec = await post('/api/recover', { nickname: nick, recoveryCode: c.recoveryCode, newPassword: 'nouveaumdp' });
    expect(rec.status).toBe(200);
    const r = (await rec.json()) as { token: string; recoveryCode: string };
    expect(r.recoveryCode).not.toBe(c.recoveryCode);
    expect((await post('/api/recover', { nickname: nick, recoveryCode: c.recoveryCode, newPassword: 'nouveaumdp' })).status).toBe(401);
  });

  it('answers errors as JSON', async () => {
    expect(await (await post('/api/accounts', '{nope')).json()).toMatchObject({ error: 'bad_json' });
    expect((await post('/api/accounts', '[1]')).status).toBe(400);
    const big = await post('/api/accounts', { nickname: 'x', password: 'y'.repeat(9000) });
    expect(big.status).toBe(413);
    expect((await fetch(`${base}/api/nothing`)).status).toBe(404);
    expect(await (await post('/api/accounts', { nickname: '!!', password: 'motdepasse' })).json()).toMatchObject({ error: 'invalid_nickname' });
  });

  it('allows CORS for the client origin and localhost only', async () => {
    const allowed = await fetch(`${base}/api/health`, { headers: { Origin: 'https://example.test' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://example.test');
    expect(allowed.headers.get('vary')).toBe('Origin');
    const local = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:5174' } });
    expect(local.headers.get('access-control-allow-origin')).toBe('http://localhost:5174');
    const refused = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.test' } });
    expect(refused.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await fetch(`${base}/api/accounts`, { method: 'OPTIONS', headers: { Origin: 'https://example.test', 'Access-Control-Request-Method': 'POST' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE');
    expect(pre.headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type');
    expect(pre.headers.get('access-control-max-age')).toBe('600');
    expect(originAllowed('http://127.0.0.1:2567', [])).toBe(true);
    expect(originAllowed('http://localhost.evil.test', [])).toBe(false);
    expect(parseOrigins(undefined)).toEqual(['https://seven74ai.github.io']);
    expect(parseOrigins('https://a.test/, https://b.test')).toEqual(['https://a.test', 'https://b.test']);
  });

  it('names a seat after the account of a valid session; an invalid one joins as a guest', async () => {
    const nick = `Salle${Date.now() % 1e6}`;
    const c = (await (await post('/api/accounts', { nickname: nick, password: 'motdepasse' })).json()) as { token: string };
    const url = `ws://localhost:${port}`;
    const host = await new Client(url).create('duel', { mode: 'shared', nickname: 'Usurpateur', session: c.token });
    const lobby = new Promise<LobbyMessage>((res) => host.onMessage('lobby', res));
    expect((await lobby).seats[0]).toBe(nick);
    host.onMessage('view', () => {});
    const guest = await new Client(url).joinById(host.roomId, { nickname: 'Invité', session: 'faux-jeton' });
    const seen = await new Promise<LobbyMessage>((res) => guest.onMessage('lobby', res));
    guest.onMessage('view', () => {});
    expect(seen.seats).toEqual([nick, 'Invité']);
    guest.send('action', { type: 'concede', player: 1 });
    await new Promise((r) => setTimeout(r, 200));
    await guest.leave(true);
    await host.leave(true);
  }, 20000);
});
