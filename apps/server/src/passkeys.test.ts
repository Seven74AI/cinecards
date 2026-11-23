import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { relyingParty } from './api/http.ts';
import { CEREMONY_TTL_MS, Ceremonies, PasskeyService, deviceName } from './auth/passkeys.ts';
import { AccountService } from './auth/service.ts';
import { insertAccount, type AccountRow } from './db/accounts.ts';
import { MIGRATIONS, openDb, schemaVersion } from './db/db.ts';
import { insertPasskey } from './db/passkeys.ts';
import { startServer } from './main.ts';

/** Story 8.2: passkeys and the recovery code. The WebAuthn signatures themselves are covered by e2e/passkeys.spec.ts. */

const clock = () => {
  const c = { t: Date.UTC(2026, 10, 22, 12), now: () => c.t };
  return c;
};
const setup = () => {
  const c = clock();
  const s = new AccountService(openDb(':memory:'), c.now);
  return { c, s, p: new PasskeyService(s) };
};
const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};
const RP = { rpID: 'example.test', origin: 'https://example.test' };

/** A key stored as if it had been registered (no real crypto: only the bookkeeping is tested here). */
const fakeKey = (s: AccountService, accountId: number, id: string) =>
  insertPasskey(s.db, { id, account_id: accountId, public_key: new Uint8Array([1, 2, 3]), counter: 0, transports: '["internal"]', rp_id: RP.rpID, name: 'iPhone', created_at: s.now() });

/** An account with only a passkey (no password), signed in. */
const passkeyAccount = (s: AccountService, nickname: string) => {
  const id = insertAccount(s.db, { nickname, key: nickname.toLowerCase(), passwordHash: null, recoveryHash: 'x', now: s.now() })!;
  fakeKey(s, id, `key-${nickname}-1`);
  return { id, token: s.openSession(id) };
};

describe('8.2 database', () => {
  it('upgrades a version-1 database with an account to the latest version without loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cinecards-db2-'));
    try {
      const path = join(dir, 'cinecards.db');
      // the production database as story 8.1 left it
      const v1 = new DatabaseSync(path);
      v1.exec(MIGRATIONS[0]!);
      v1.exec('PRAGMA user_version = 1');
      v1.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES ('Léa', 'léa', 'scrypt$hash', 'rec', 42)").run();
      v1.prepare("INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at) VALUES ('tok', 1, 42, 43)").run();
      v1.close();

      const db = openDb(path);
      expect(schemaVersion(db)).toBe(MIGRATIONS.length); // later migrations (8.3) run too
      const row = db.prepare('SELECT * FROM accounts').get() as unknown as AccountRow;
      expect(row).toMatchObject({ id: 1, nickname: 'Léa', nickname_key: 'léa', password_hash: 'scrypt$hash', recovery_hash: 'rec', created_at: 42, webauthn_user_id: null });
      expect(db.prepare('SELECT * FROM sessions').all()).toEqual([{ token_hash: 'tok', account_id: 1, created_at: 42, last_seen_at: 43 }]);
      expect(db.prepare('SELECT COUNT(*) AS n FROM passkeys').get()).toEqual({ n: 0 });
      // keys go with their account
      db.prepare("INSERT INTO passkeys (id, account_id, public_key, counter, rp_id, name, created_at) VALUES ('k', 1, x'01', 0, 'localhost', 'Mac', 1)").run();
      db.prepare('DELETE FROM accounts WHERE id = 1').run();
      expect(db.prepare('SELECT COUNT(*) AS n FROM passkeys').get()).toEqual({ n: 0 });
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('8.2 relying party and ceremonies', () => {
  it('takes the relying party from an allowed Origin only', () => {
    const allowed = ['https://seven74ai.github.io'];
    expect(relyingParty('https://seven74ai.github.io', allowed)).toEqual({ rpID: 'seven74ai.github.io', origin: 'https://seven74ai.github.io' });
    expect(relyingParty('http://localhost:5274', allowed)).toEqual({ rpID: 'localhost', origin: 'http://localhost:5274' });
    expect(relyingParty('https://evil.test', allowed)).toBeNull();
    expect(relyingParty(undefined, allowed)).toBeNull();
  });

  it('names a key after the device', () => {
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iPhone');
    expect(deviceName('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('iPad');
    expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('Mac');
    expect(deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('Android');
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(deviceName('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
    expect(deviceName(undefined)).toBe('Appareil');
  });

  it('uses a challenge once, even when the check fails', async () => {
    const { p } = setup();
    const { ceremony } = ok(await p.loginOptions(RP));
    expect(await p.loginVerify(RP, ceremony, { id: 'nope' })).toMatchObject({ status: 401, error: 'unknown_passkey', message: 'Cette clé d’accès n’est plus liée à un compte.' });
    expect(await p.loginVerify(RP, ceremony, { id: 'nope' })).toMatchObject({ status: 400, error: 'ceremony_expired', message: 'La demande a expiré. Réessaie.' });
    // a garbage registration response fails and spends its ceremony too
    const reg = ok(await p.registerOptions(RP, null, 'Neo'));
    expect(await p.registerVerify(RP, null, reg.ceremony, { id: 'x', response: {} }, undefined)).toMatchObject({ status: 400, error: 'passkey_failed' });
    expect(await p.registerVerify(RP, null, reg.ceremony, { id: 'x', response: {} }, undefined)).toMatchObject({ error: 'ceremony_expired' });
    expect(p.ceremonies.size).toBe(0);
  });

  it('expires a challenge after 5 minutes and binds it to its origin', async () => {
    const { p, c } = setup();
    const a = ok(await p.loginOptions(RP));
    c.t += CEREMONY_TTL_MS + 1;
    expect(await p.loginVerify(RP, a.ceremony, { id: 'nope' })).toMatchObject({ error: 'ceremony_expired' });
    const b = ok(await p.loginOptions(RP));
    expect(await p.loginVerify({ rpID: 'localhost', origin: 'http://localhost:5173' }, b.ceremony, { id: 'nope' })).toMatchObject({ error: 'ceremony_expired' });
    // a login ceremony cannot finish a registration
    const d = ok(await p.loginOptions(RP));
    expect(await p.registerVerify(RP, null, d.ceremony, { id: 'x' }, undefined)).toMatchObject({ error: 'ceremony_expired' });
  });

  it('keeps at most 1,000 pending ceremonies, dropping the oldest', () => {
    const c = clock();
    const cer = new Ceremonies(c.now);
    const first = cer.put({ ...RP, kind: 'login', challenge: 'c', expires: c.t + 1000 });
    for (let i = 0; i < 1000; i++) cer.put({ ...RP, kind: 'login', challenge: `c${i}`, expires: c.t + 1000 });
    expect(cer.size).toBe(1000);
    expect(cer.take(first)).toBeNull();
    c.t += 1001;
    cer.purge();
    expect(cer.size).toBe(0);
  });

  it('asks for a discoverable key with a random user handle, and checks the nickname first', async () => {
    const { p, s } = setup();
    const r = ok(await p.registerOptions(RP, null, '  Trinity  '));
    expect(r.options.rp).toEqual({ name: 'CineCards', id: 'example.test' });
    expect(r.options.user.name).toBe('Trinity');
    expect(r.options.user.id).not.toContain('Trinity');
    expect(r.options.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'preferred' });
    expect(r.options.attestation).toBe('none');
    expect(await p.registerOptions(RP, null, 'ab')).toMatchObject({ status: 400, error: 'invalid_nickname' });
    ok(await s.create('Morpheus', 'motdepasse'));
    expect(await p.registerOptions(RP, null, 'morpheus')).toMatchObject({ status: 409, error: 'nickname_taken' });
    // nothing is reserved before the key is verified
    expect(s.db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE nickname = 'Trinity'").get()).toEqual({ n: 0 });
    // adding a key: the session's account, its existing keys excluded, the same handle every time
    const m = ok(await s.login('Morpheus', 'motdepasse'));
    fakeKey(s, m.account.id, 'old-key');
    const add = ok(await p.registerOptions(RP, m.token, undefined));
    expect(add.options.user.name).toBe('Morpheus');
    expect(add.options.excludeCredentials?.map((k) => k.id)).toEqual(['old-key']);
    const again = ok(await p.registerOptions(RP, m.token, undefined));
    expect(again.options.user.id).toBe(add.options.user.id);
    expect(await p.registerOptions(RP, 'bad-token', undefined)).toMatchObject({ status: 401, error: 'unauthorized' });
  });
});

describe('8.2 account management', () => {
  it('lists the account and its keys', async () => {
    const { s, p, c } = setup();
    const a = passkeyAccount(s, 'Smith');
    c.t += 1000;
    fakeKey(s, a.id, 'key-Smith-2');
    const d = ok(p.details(a.token));
    expect(d.account).toEqual({ id: a.id, nickname: 'Smith' });
    expect(d.hasPassword).toBe(false);
    expect(d.passkeys).toEqual([
      { id: 'key-Smith-1', name: 'iPhone', createdAt: c.t - 1000, lastUsedAt: null },
      { id: 'key-Smith-2', name: 'iPhone', createdAt: c.t, lastUsedAt: null },
    ]);
    expect(p.details('nope')).toMatchObject({ status: 401 });
  });

  it('never removes the last way to sign in', async () => {
    const { s, p } = setup();
    const a = passkeyAccount(s, 'Oracle');
    expect(p.remove(a.token, 'key-Oracle-1')).toMatchObject({
      status: 409,
      error: 'last_login_method',
      message: 'C’est ta seule façon de te connecter : ajoute d’abord une autre clé ou un mot de passe.',
    });
    fakeKey(s, a.id, 'key-Oracle-2');
    ok(p.remove(a.token, 'key-Oracle-1'));
    expect(p.remove(a.token, 'key-Oracle-2')).toMatchObject({ status: 409 });
    // with a password the last key can go
    ok(await s.changePassword(a.token, undefined, 'motdepasse'));
    ok(p.remove(a.token, 'key-Oracle-2'));
    expect(ok(p.details(a.token)).passkeys).toEqual([]);
    // only its own account removes a key
    const b = passkeyAccount(s, 'Cypher');
    fakeKey(s, b.id, 'key-Cypher-2');
    expect(p.remove(a.token, 'key-Cypher-2')).toMatchObject({ status: 404 });
    expect(ok(p.details(b.token)).passkeys).toHaveLength(2);
  });

  it('chooses a password without the old one, changes it with it, and closes the other sessions', async () => {
    const { s } = setup();
    const a = passkeyAccount(s, 'Switch');
    const other = s.openSession(a.id);
    expect(await s.changePassword(a.token, undefined, 'court')).toMatchObject({ status: 400, error: 'invalid_password' });
    ok(await s.changePassword(a.token, undefined, 'motdepasse'));
    expect(s.accountOf(a.token)).not.toBeNull();
    expect(s.accountOf(other)).toBeNull();
    ok(await s.login('Switch', 'motdepasse'));
    // now the old password is required
    expect(await s.changePassword(a.token, undefined, 'nouveaumdp')).toMatchObject({ status: 403, error: 'bad_credentials', message: 'Ancien mot de passe incorrect.' });
    expect(await s.changePassword(a.token, 'pasleboncode', 'nouveaumdp')).toMatchObject({ status: 403 });
    ok(await s.changePassword(a.token, 'motdepasse', 'nouveaumdp'));
    ok(await s.login('Switch', 'nouveaumdp'));
    expect(await s.changePassword('nope', 'nouveaumdp', 'encoreunautre')).toMatchObject({ status: 401 });
  });

  it('counts a wrong old password towards the attempt limit', async () => {
    const { s } = setup();
    const a = ok(await s.create('Mouse', 'motdepasse'));
    for (let i = 0; i < 10; i++) expect(await s.changePassword(a.token, `faux${i}xxxx`, 'nouveaumdp')).toMatchObject({ status: 403 });
    expect(await s.changePassword(a.token, 'motdepasse', 'nouveaumdp')).toMatchObject({ status: 429 });
    expect(await s.login('Mouse', 'motdepasse')).toMatchObject({ status: 429 });
  });

  it('recovers without a new password: sessions closed, new session and code, password unchanged', async () => {
    const { s } = setup();
    const a = ok(await s.create('Apoc', 'motdepasse'));
    const r = ok(await s.recover('apoc', a.recoveryCode));
    expect(r.recoveryCode).not.toBe(a.recoveryCode);
    expect(s.accountOf(a.token)).toBeNull();
    expect(s.accountOf(r.token)).toEqual(a.account);
    ok(await s.login('Apoc', 'motdepasse'));
    expect(await s.recover('Apoc', a.recoveryCode)).toMatchObject({ status: 401, error: 'bad_credentials' });
    // with a new password it behaves as in story 8.1
    expect(await s.recover('Apoc', r.recoveryCode, 'court')).toMatchObject({ status: 400, error: 'invalid_password' });
    ok(await s.recover('Apoc', r.recoveryCode, 'nouveaumdp'));
    ok(await s.login('Apoc', 'nouveaumdp'));
  });
});

describe('8.2 HTTP API', () => {
  const port = 26770 + Math.floor(Math.random() * 100);
  const base = `http://localhost:${port}`;
  const ORIGIN = 'https://example.test';
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    server = await startServer(port, undefined, { dataDir: ':memory:', clientOrigins: [ORIGIN] });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  it('answers passkey options for an allowed origin only', async () => {
    const r = await post('/api/passkeys/login/options', {}, { Origin: ORIGIN });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const body = (await r.json()) as { ceremony: string; options: { rpId: string; challenge: string; allowCredentials?: unknown[] } };
    expect(body.ceremony).toMatch(/^[\w-]{20,}$/);
    expect(body.options.rpId).toBe('example.test');
    expect(body.options.allowCredentials ?? []).toEqual([]);
    const reg = await post('/api/passkeys/register/options', { nickname: 'Niobe' }, { Origin: 'http://localhost:5274' });
    expect(((await reg.json()) as { options: { rp: { id: string } } }).options.rp.id).toBe('localhost');
    for (const headers of [{ Origin: 'https://evil.test' }, {}] as Record<string, string>[]) {
      const refused = await post('/api/passkeys/login/options', {}, headers);
      expect(refused.status).toBe(403);
      expect(await refused.json()).toMatchObject({ error: 'origin_not_allowed' });
    }
    const expired = await post('/api/passkeys/login/verify', { ceremony: 'nope', response: { id: 'x' } }, { Origin: ORIGIN });
    expect(expired.status).toBe(400);
    expect(await expired.json()).toEqual({ error: 'ceremony_expired', message: 'La demande a expiré. Réessaie.' });
  });

  it('reads the account, changes the password, recovers without one and refuses an unknown key', async () => {
    const nick = `Pk${Date.now() % 1e6}`;
    const c = (await (await post('/api/accounts', { nickname: nick, password: 'motdepasse' })).json()) as { token: string; recoveryCode: string };
    const auth = { Authorization: `Bearer ${c.token}` };
    const acc = await fetch(`${base}/api/account`, { headers: auth });
    expect(await acc.json()).toMatchObject({ account: { nickname: nick }, hasPassword: true, passkeys: [] });
    expect((await fetch(`${base}/api/account`)).status).toBe(401);
    expect((await post('/api/password', { currentPassword: 'faux-faux', newPassword: 'nouveaumdp' }, auth)).status).toBe(403);
    const changed = await post('/api/password', { currentPassword: 'motdepasse', newPassword: 'nouveaumdp' }, auth);
    expect(changed.status).toBe(204);
    expect(await changed.text()).toBe('');
    const del = await fetch(`${base}/api/passkeys/nope`, { method: 'DELETE', headers: auth });
    expect(del.status).toBe(404);
    // the recovery code alone (the client then adds a passkey with the new session)
    const rec = await post('/api/recover', { nickname: nick, recoveryCode: c.recoveryCode });
    expect(rec.status).toBe(200);
    const r = (await rec.json()) as { token: string; recoveryCode: string };
    expect(r.recoveryCode).not.toBe(c.recoveryCode);
    expect((await fetch(`${base}/api/account`, { headers: auth })).status).toBe(401);
    expect((await fetch(`${base}/api/account`, { headers: { Authorization: `Bearer ${r.token}` } })).status).toBe(200);
    expect((await post('/api/sessions', { nickname: nick, password: 'nouveaumdp' })).status).toBe(200);
  });
});
