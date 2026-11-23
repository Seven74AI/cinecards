import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { playableCardIds } from '@cinecards/engine';
import { AccountService } from './auth/service.ts';
import { MIGRATIONS, openDb, schemaVersion } from './db/db.ts';
import { DECK_LIMITS, DeckService } from './decks/decks.ts';
import { startServer } from './main.ts';

/** Story 10.2: constructed decks saved on the account. */

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};

const { catalog } = loadSetsFromDir(fileURLToPath(new URL('../../../content/sets', import.meta.url)));
const PLAYABLE = playableCardIds(catalog);
const full = PLAYABLE.slice(0, 50);

describe('10.2 database', () => {
  it('upgrades a database at the previous version to the decks table without loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cinecards-decks-'));
    try {
      const path = join(dir, 'cinecards.db');
      const prev = MIGRATIONS.length - 1;
      const old = new DatabaseSync(path);
      for (let v = 0; v < prev; v++) old.exec(MIGRATIONS[v]!);
      old.exec(`PRAGMA user_version = ${prev}`);
      old.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES ('Léa', 'léa', 'scrypt$hash', 'rec', 42)").run();
      old.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES ('Tom', 'tom', NULL, 'rec2', 43)").run();
      old.prepare("INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at) VALUES ('tok', 1, 42, 43)").run();
      const before = { accounts: old.prepare('SELECT * FROM accounts ORDER BY id').all(), sessions: old.prepare('SELECT * FROM sessions').all() };
      expect(() => old.prepare('SELECT * FROM decks').all()).toThrow();
      old.close();

      const db = openDb(path);
      expect(schemaVersion(db)).toBe(MIGRATIONS.length);
      expect(db.prepare('SELECT * FROM accounts ORDER BY id').all()).toEqual(before.accounts);
      expect(db.prepare('SELECT * FROM sessions').all()).toEqual(before.sessions);
      db.prepare("INSERT INTO decks (account_id, name, cards, created_at, updated_at) VALUES (2, 'D', '[]', 1, 1)").run();
      expect(() => db.prepare("INSERT INTO decks (account_id, name, cards, created_at, updated_at) VALUES (99, 'D', '[]', 1, 1)").run()).toThrow();
      // a deleted account takes its decks with it
      db.prepare('DELETE FROM accounts WHERE id = 2').run();
      expect(db.prepare('SELECT COUNT(*) AS n FROM decks').get()).toEqual({ n: 0 });
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('10.2 deck service', () => {
  const setup = async () => {
    const c = { t: Date.UTC(2026, 10, 23, 12), now: () => c.t };
    const db = openDb(':memory:');
    const accounts = new AccountService(db, c.now);
    const decks = new DeckService(db, (t) => accounts.accountOf(t), catalog, PLAYABLE, c.now);
    const a = ok(await accounts.create('Alice', 'motdepasse'));
    const b = ok(await accounts.create('Bruno', 'motdepasse'));
    return { c, decks, a, b };
  };

  it('saves an incomplete deck with its status, then completes it', async () => {
    const { c, decks, a } = await setup();
    const d = ok(decks.create(a.token, { name: '  Chevaliers   et agents ', cards: full.slice(0, 47) })).deck;
    expect(d).toMatchObject({ name: 'Chevaliers et agents', valid: false, errors: ['Il manque 3 cartes (50 exactement).'] });
    expect(d.cards).toHaveLength(47);
    c.t += 1000;
    const u = ok(decks.update(a.token, d.id, { cards: full })).deck;
    expect(u).toMatchObject({ id: d.id, name: 'Chevaliers et agents', valid: true, errors: [], updatedAt: c.t });
    // only the name changes; the cards stay
    expect(ok(decks.update(a.token, d.id, { name: 'Élus' })).deck).toMatchObject({ name: 'Élus', valid: true });
    expect(ok(decks.list(a.token)).decks).toEqual([expect.objectContaining({ id: d.id, name: 'Élus', valid: true })]);
  });

  it('defaults the name, drops duplicates, counts the cards over 50 and refuses unknown cards', async () => {
    const { decks, a } = await setup();
    expect(ok(decks.create(a.token, {})).deck).toMatchObject({ name: 'Nouveau deck', cards: [], valid: false });
    expect(ok(decks.create(a.token, { name: '   ', cards: [full[0], full[0], full[1]] })).deck).toMatchObject({ name: 'Nouveau deck', cards: [full[0], full[1]] });
    const over = ok(decks.create(a.token, { cards: PLAYABLE.slice(0, 51) })).deck;
    expect(over.errors[0]).toBe('1 carte de trop (50 exactement).');
    expect(decks.create(a.token, { cards: ['mx-neo', 'zz-nobody'] })).toMatchObject({ ok: false, status: 400, error: 'unknown_card' });
    expect(decks.create(a.token, { cards: 'mx-neo' })).toMatchObject({ ok: false, status: 400, error: 'bad_cards' });
    expect(decks.create(a.token, { cards: [1, 2] })).toMatchObject({ ok: false, status: 400, error: 'bad_cards' });
    expect(decks.create(a.token, { cards: Array.from({ length: 61 }, () => 'mx-neo') })).toMatchObject({ ok: false, status: 400, error: 'bad_cards' });
    expect(decks.create(a.token, { name: 'x'.repeat(31) })).toMatchObject({ ok: false, status: 400, error: 'bad_name' });
    expect(ok(decks.create(a.token, { name: 'é'.repeat(30) })).deck.name).toBe('é'.repeat(30));
    expect(decks.create(a.token, { name: 42 })).toMatchObject({ ok: false, status: 400, error: 'bad_name' });
  });

  it(`keeps at most ${DECK_LIMITS.decksPerAccount} decks per account`, async () => {
    const { decks, a, b } = await setup();
    for (let i = 0; i < DECK_LIMITS.decksPerAccount; i++) ok(decks.create(a.token, { name: `D${i}` }));
    expect(decks.create(a.token, { name: 'Trop' })).toMatchObject({ ok: false, status: 409, error: 'deck_limit', message: 'Tu as déjà 20 decks : supprimes-en un d’abord.' });
    // the limit is per account
    ok(decks.create(b.token, { name: 'Le mien' }));
    const first = ok(decks.list(a.token)).decks[0]!;
    ok(decks.remove(a.token, first.id));
    ok(decks.create(a.token, { name: 'Encore un' }));
  });

  it('lets an account see and change only its own decks', async () => {
    const { decks, a, b } = await setup();
    const d = ok(decks.create(a.token, { name: 'Secret', cards: full.slice(0, 3) })).deck;
    expect(ok(decks.list(b.token)).decks).toEqual([]);
    expect(decks.update(b.token, d.id, { name: 'Volé' })).toMatchObject({ ok: false, status: 404, error: 'not_found' });
    expect(decks.remove(b.token, d.id)).toMatchObject({ ok: false, status: 404 });
    expect(ok(decks.list(a.token)).decks[0]).toMatchObject({ name: 'Secret' });
    expect(decks.list('nope')).toMatchObject({ ok: false, status: 401 });
    expect(decks.create(null, {})).toMatchObject({ ok: false, status: 401 });
    ok(decks.remove(a.token, d.id));
    expect(decks.remove(a.token, d.id)).toMatchObject({ ok: false, status: 404 });
  });
});

describe('10.2 HTTP API', () => {
  const port = 26870 + Math.floor(Math.random() * 100);
  const base = `http://localhost:${port}`;
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    server = await startServer(port, undefined, { dataDir: ':memory:' });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });
  const api = (method: string, path: string, token?: string, body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { Origin: 'http://localhost:5173', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let n = 0;
  const account = async () => {
    const nickname = `Deck${Date.now() % 1e5}${n++}`;
    const r = (await (await api('POST', '/api/accounts', undefined, { nickname, password: 'motdepasse' })).json()) as { token: string };
    return r.token;
  };

  it('announces decks in /api/health and allows PUT from the browser', async () => {
    expect(await (await api('GET', '/api/health')).json()).toMatchObject({ decks: true });
    const pre = await api('OPTIONS', '/api/decks/1');
    expect(pre.headers.get('access-control-allow-methods')).toContain('PUT');
  });

  it('creates, lists, updates and deletes a deck; another account gets 404', async () => {
    const t = await account();
    const other = await account();
    expect((await api('GET', '/api/decks')).status).toBe(401);
    const created = await api('POST', '/api/decks', t, { name: 'Mon deck', cards: full.slice(0, 10) });
    expect(created.status).toBe(201);
    const { deck } = (await created.json()) as { deck: { id: number; valid: boolean; errors: string[] } };
    expect(deck).toMatchObject({ valid: false, errors: ['Il manque 40 cartes (50 exactement).'] });
    // the client cannot claim a status: the server computes it
    const put = await api('PUT', `/api/decks/${deck.id}`, t, { cards: full, valid: false, errors: ['x'] });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { deck: unknown }).deck).toMatchObject({ id: deck.id, valid: true, errors: [] });
    expect(((await (await api('GET', '/api/decks', t)).json()) as { decks: unknown[] }).decks).toEqual([expect.objectContaining({ id: deck.id, name: 'Mon deck', valid: true })]);
    expect((await api('PUT', `/api/decks/${deck.id}`, other, { name: 'Volé' })).status).toBe(404);
    expect((await api('DELETE', `/api/decks/${deck.id}`, other)).status).toBe(404);
    const bad = await api('POST', '/api/decks', t, { cards: ['zz-nobody'] });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'unknown_card' });
    expect((await api('DELETE', `/api/decks/${deck.id}`, t)).status).toBe(204);
    expect(((await (await api('GET', '/api/decks', t)).json()) as { decks: unknown[] }).decks).toEqual([]);
  });
});
