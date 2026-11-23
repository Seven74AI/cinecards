import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client, type Room } from '@colyseus/sdk';
import type { LobbyMessage, ViewMessage } from '@cinecards/protocol';
import { AccountService } from './auth/service.ts';
import { MIGRATIONS, openDb, schemaVersion } from './db/db.ts';
import { recentGames, record, recordGame, type GameResult } from './db/games.ts';
import { HistoryService, seatResults, type FinishedDuel, type HistoryList } from './history.ts';
import { startServer } from './main.ts';
import { roomConfig } from './room.ts';

/** Story 8.4: game history. */

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};

describe('8.4 database', () => {
  it('upgrades a version-3 database with accounts, sessions, passkeys and friendships without loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cinecards-db4-'));
    try {
      const path = join(dir, 'cinecards.db');
      // the production database as story 8.3 left it
      const v3 = new DatabaseSync(path);
      for (const m of MIGRATIONS.slice(0, 3)) v3.exec(m);
      v3.exec('PRAGMA user_version = 3');
      v3.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at, webauthn_user_id) VALUES ('Léa', 'léa', 'scrypt$hash', 'rec', 42, 'h1')").run();
      v3.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES ('Tom', 'tom', NULL, 'rec2', 43)").run();
      v3.prepare("INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at) VALUES ('tok', 1, 42, 43)").run();
      v3.prepare("INSERT INTO passkeys (id, account_id, public_key, counter, rp_id, name, created_at) VALUES ('k', 2, x'01', 3, 'cinecards.sevend.io', 'iPhone', 44)").run();
      v3.prepare("INSERT INTO friendships (a, b, requested_by, status, created_at, accepted_at) VALUES (1, 2, 1, 'accepted', 45, 46)").run();
      const tables = ['accounts', 'sessions', 'passkeys', 'friendships'];
      const before = Object.fromEntries(tables.map((t) => [t, v3.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));
      v3.close();

      const db = openDb(path);
      expect(schemaVersion(db)).toBe(MIGRATIONS.length); // later migrations (10.2) run too
      for (const t of tables) expect(db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all(), t).toMatchObject(before[t]!);
      expect(db.prepare('SELECT COUNT(*) AS n FROM games').get()).toEqual({
        n: 0,
      });
      // results are checked by the database too
      const id = recordGame(db, {
        mode: 'shared',
        turns: 7,
        startedAt: 1000,
        endedAt: 61_000,
        players: [
          { accountId: 1, nickname: 'Léa', result: 'win' },
          { accountId: 2, nickname: 'Tom', result: 'loss' },
        ],
      });
      expect(() => db.prepare("INSERT INTO game_players (game_id, seat, account_id, nickname, result) VALUES (?, 2, 1, 'x', 'bravo')").run(id)).toThrow();
      // a deleted account keeps the other player's history, as a guest
      db.prepare('DELETE FROM accounts WHERE id = 2').run();
      expect(recentGames(db, 1)).toEqual([
        {
          id,
          result: 'win',
          opponent: { nickname: 'Tom', isGuest: true },
          mode: 'shared',
          turns: 7,
          endedAt: 61_000,
          durationMs: 60_000,
        },
      ]);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a failed insert leaves nothing behind (one transaction)', () => {
    const db = openDb(':memory:');
    expect(() =>
      recordGame(db, {
        mode: 'shared',
        turns: 1,
        startedAt: 0,
        endedAt: 1,
        players: [
          { accountId: null, nickname: 'A', result: 'win' },
          { accountId: null, nickname: 'B', result: 'oops' as GameResult },
        ],
      }),
    ).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM games').get()).toEqual({
      n: 0,
    });
    expect(db.prepare('SELECT COUNT(*) AS n FROM game_players').get()).toEqual({
      n: 0,
    });
  });
});

describe('8.4 results and record', () => {
  it('reads each seat’s result from the engine’s winner and the conceded event', () => {
    expect(seatResults(0, null)).toEqual(['win', 'loss']);
    expect(seatResults(1, null)).toEqual(['loss', 'win']);
    expect(seatResults('draw', null)).toEqual(['draw', 'draw']);
    expect(seatResults(0, 1)).toEqual(['opponent_conceded', 'conceded']);
    expect(seatResults(1, 0)).toEqual(['conceded', 'opponent_conceded']);
  });

  it('keeps games with an account only, lists the latest 20 newest first and counts concessions as wins and losses', async () => {
    const db = openDb(':memory:');
    const accounts = new AccountService(db);
    const a = ok(await accounts.create('Alice', 'motdepasse'));
    const b = ok(await accounts.create('Bruno', 'motdepasse'));
    const h = new HistoryService(db, (t) => accounts.accountOf(t));
    const duel = (over: Partial<FinishedDuel>): FinishedDuel => ({
      mode: 'shared',
      turns: 5,
      startedAt: 0,
      endedAt: 1000,
      accounts: [a.account.id, b.account.id],
      names: ['Alice', 'Bruno'],
      winner: 0,
      concededBy: null,
      ...over,
    });
    expect(h.record(duel({ accounts: [null, null], names: ['X', 'Y'] }))).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS n FROM games').get()).toEqual({
      n: 0,
    });
    h.record(duel({ winner: 0 })); // Alice wins
    h.record(duel({ winner: 1, concededBy: 0 })); // Alice concedes
    h.record(duel({ winner: 'draw' }));
    h.record(
      duel({
        winner: 0,
        concededBy: 1,
        accounts: [a.account.id, null],
        names: ['Alice', 'Zoé'],
        mode: 'randomSplit',
      }),
    );
    expect(record(db, a.account.id)).toEqual({ wins: 2, losses: 1, draws: 1 });
    expect(record(db, b.account.id)).toEqual({ wins: 1, losses: 1, draws: 1 });
    const listA = ok(h.list(a.token));
    expect(listA.games.map((g) => g.result)).toEqual(['opponent_conceded', 'draw', 'conceded', 'win']);
    expect(listA.games[0]).toMatchObject({
      opponent: { nickname: 'Zoé', isGuest: true },
      mode: 'randomSplit',
    });
    expect(listA.games[1]!.opponent).toEqual({
      nickname: 'Bruno',
      isGuest: false,
    });
    expect(ok(h.list(b.token)).games).toHaveLength(3);
    for (let i = 0; i < 20; i++) h.record(duel({ turns: 100 + i }));
    const long = ok(h.list(a.token));
    expect(long.games).toHaveLength(20);
    expect(long.games[0]!.turns).toBe(119);
    expect(long.games[19]!.turns).toBe(100);
    expect(long.record.wins).toBe(22); // every game counts in the record
    expect(h.list('faux')).toMatchObject({
      ok: false,
      status: 401,
      error: 'unauthorized',
    });
  });
});

describe('8.4 over WebSocket', () => {
  const port = 27770 + Math.floor(Math.random() * 100);
  const base = `http://localhost:${port}`;
  const url = `ws://localhost:${port}`;
  let server: Awaited<ReturnType<typeof startServer>>;
  /** Every game the rooms handed to the history (kept or not). */
  const handed: FinishedDuel[] = [];
  beforeAll(async () => {
    roomConfig.reconnectSeconds = 2;
    server = await startServer(port, undefined, { dataDir: ':memory:' });
    const real = roomConfig.history!;
    roomConfig.history = { record: (g) => (handed.push(g), real.record(g)) };
  });
  afterAll(async () => {
    roomConfig.reconnectSeconds = undefined;
    await server.gracefullyShutdown(false);
  });
  let n = 0;
  const account = async (prefix: string) => {
    const nickname = `${prefix}${Date.now() % 1e5}${n++}`;
    const r = await fetch(`${base}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password: 'motdepasse' }),
    });
    const body = (await r.json()) as { token: string; account: { id: number } };
    return { token: body.token, id: body.account.id, nickname };
  };
  const history = async (token: string) =>
    (await (
      await fetch(`${base}/api/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()) as HistoryList;
  const until = async (check: () => unknown, ms = 4000) => {
    const end = Date.now() + ms;
    while (!(await check())) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 30));
    }
  };
  /** Seat 0 creates, seat 1 joins; each with a session token or a guest nickname. */
  const duel = async (x: { session: string } | { nickname: string }, y: { session: string } | { nickname: string }, mode = 'shared') => {
    const views: ViewMessage[] = [];
    const r0 = await new Client(url).create('duel', { mode, ...x });
    r0.onMessage('view', (m: ViewMessage) => views.push(m));
    const lobby = await new Promise<LobbyMessage>((res) => r0.onMessage('lobby', res));
    const r1 = await new Client(url).joinById(lobby.code, y);
    r1.onMessage('view', () => {});
    r1.onMessage('lobby', () => {});
    await until(() => views.length > 0);
    return { r0, r1, views };
  };
  const leaveAll = async (...rooms: Room[]) => {
    for (const r of rooms) await r.leave(true).catch(() => {});
  };

  it('answers /api/history only with a session, and /api/health says history', async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toMatchObject({
      history: true,
    });
    expect((await fetch(`${base}/api/history`)).status).toBe(401);
    const a = await account('Ne');
    expect(await history(a.token)).toEqual({
      record: { wins: 0, losses: 0, draws: 0 },
      games: [],
    });
  });

  it('two accounts: a concession gives each one line with their own result', async () => {
    const a = await account('Ca');
    const b = await account('Cb');
    const { r0, r1, views } = await duel({ session: a.token }, { session: b.token }, 'randomSplit');
    r1.send('action', { type: 'concede', player: 1 });
    await until(() => views.at(-1)!.view.state.phase === 'finished');
    await until(async () => (await history(a.token)).games.length === 1);
    const ha = await history(a.token);
    const hb = await history(b.token);
    expect(ha.games[0]).toMatchObject({
      result: 'opponent_conceded',
      opponent: { nickname: b.nickname, isGuest: false },
      mode: 'randomSplit',
    });
    expect(ha.games[0]!.turns).toBeGreaterThanOrEqual(1);
    expect(ha.games[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(hb.games).toHaveLength(1);
    expect(hb.games[0]).toMatchObject({
      id: ha.games[0]!.id,
      result: 'conceded',
      opponent: { nickname: a.nickname, isGuest: false },
    });
    expect(ha.record).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(hb.record).toEqual({ wins: 0, losses: 1, draws: 0 });
    // the engine ignores anything after the end: still one game
    r0.send('action', { type: 'concede', player: 0 });
    await new Promise((r) => setTimeout(r, 200));
    expect((await history(a.token)).games).toHaveLength(1);
    await leaveAll(r0, r1);
  }, 20000);

  it('an account against a guest: one line, the guest shown as such; the guest’s concession by forfeit counts', async () => {
    const a = await account('Ga');
    const { r0, r1, views } = await duel({ nickname: 'Zoé' }, { session: a.token });
    // the guest (seat 0) leaves and does not come back within the window (2 s in tests)
    await r0.leave(true);
    await until(async () => (await history(a.token)).games.length === 1, 6000);
    expect((await history(a.token)).games[0]).toMatchObject({
      result: 'opponent_conceded',
      opponent: { nickname: 'Zoé', isGuest: true },
    });
    expect(handed.at(-1)).toMatchObject({
      accounts: [null, a.id],
      names: ['Zoé', a.nickname],
      concededBy: 0,
      winner: 1,
    });
    expect(views.length).toBeGreaterThan(0);
    await leaveAll(r1);
  }, 20000);

  it('two guests: nothing is kept', async () => {
    const before = handed.length;
    const { r0, r1, views } = await duel({ nickname: 'Un' }, { nickname: 'Deux' });
    r0.send('action', { type: 'concede', player: 0 });
    await until(() => views.at(-1)!.view.state.phase === 'finished');
    await new Promise((r) => setTimeout(r, 200));
    expect(handed.length).toBe(before); // the room does not even hand it over
    await leaveAll(r0, r1);
  }, 20000);

  it('a room that goes without a winner records nothing', async () => {
    const a = await account('Wa');
    const before = handed.length;
    const r0 = await new Client(url).create('duel', {
      mode: 'shared',
      session: a.token,
    });
    r0.onMessage('view', () => {});
    await new Promise<LobbyMessage>((res) => r0.onMessage('lobby', res));
    await r0.leave(true);
    await new Promise((r) => setTimeout(r, 200));
    expect(handed.length).toBe(before);
    expect((await history(a.token)).games).toEqual([]);
  });
});
