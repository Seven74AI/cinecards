import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Client, type Room } from '@colyseus/sdk';
import type { FriendsList, HubServerMessages, LobbyMessage } from '@cinecards/protocol';
import { AccountService } from './auth/service.ts';
import { MIGRATIONS, openDb, schemaVersion } from './db/db.ts';
import { FRIEND_LIMITS } from './social/friends.ts';
import { Social } from './social/social.ts';
import { PresenceRegistry } from './presence.ts';
import { startServer } from './main.ts';

/** Story 8.3: friends, presence and direct invitations. */

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};

describe('8.3 database', () => {
  it('upgrades a version-2 database with accounts, sessions and passkeys to version 3 without loss', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cinecards-db3-'));
    try {
      const path = join(dir, 'cinecards.db');
      // the production database as story 8.2 left it
      const v2 = new DatabaseSync(path);
      v2.exec(MIGRATIONS[0]!);
      v2.exec(MIGRATIONS[1]!);
      v2.exec('PRAGMA user_version = 2');
      v2.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at, webauthn_user_id) VALUES ('Léa', 'léa', 'scrypt$hash', 'rec', 42, 'h1')").run();
      v2.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES ('Tom', 'tom', NULL, 'rec2', 43)").run();
      v2.prepare("INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at) VALUES ('tok', 1, 42, 43)").run();
      v2.prepare("INSERT INTO passkeys (id, account_id, public_key, counter, rp_id, name, created_at) VALUES ('k', 2, x'01', 3, 'cinecards.sevend.io', 'iPhone', 44)").run();
      const before = {
        accounts: v2.prepare('SELECT * FROM accounts ORDER BY id').all(),
        sessions: v2.prepare('SELECT * FROM sessions').all(),
        passkeys: v2.prepare('SELECT * FROM passkeys').all(),
      };
      v2.close();

      const db = openDb(path);
      expect(schemaVersion(db)).toBe(MIGRATIONS.length); // later migrations (8.4) run too
      expect(db.prepare('SELECT * FROM accounts ORDER BY id').all()).toEqual(before.accounts);
      expect(db.prepare('SELECT * FROM sessions').all()).toEqual(before.sessions);
      expect(db.prepare('SELECT * FROM passkeys').all()).toEqual(before.passkeys);
      expect(db.prepare('SELECT COUNT(*) AS n FROM friendships').get()).toEqual({ n: 0 });
      // one row per pair, smaller id first; it goes with either account
      expect(() => db.prepare("INSERT INTO friendships (a, b, requested_by, status, created_at) VALUES (2, 1, 2, 'pending', 1)").run()).toThrow();
      db.prepare("INSERT INTO friendships (a, b, requested_by, status, created_at) VALUES (1, 2, 2, 'pending', 1)").run();
      db.prepare('DELETE FROM accounts WHERE id = 2').run();
      expect(db.prepare('SELECT COUNT(*) AS n FROM friendships').get()).toEqual({ n: 0 });
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('8.3 friend service', () => {
  const setup = async (names: string[]) => {
    const c = { t: Date.UTC(2026, 10, 23, 12), now: () => c.t };
    const db = openDb(':memory:');
    const accounts = new AccountService(db, c.now);
    const sent: { to: number; type: string; msg: unknown }[] = [];
    const social = new Social(db, (t) => accounts.accountOf(t), { now: c.now, findRoom: () => null });
    const realSend = social.send.bind(social);
    social.send = ((to: number, type: never, msg: never) => {
      sent.push({ to, type, msg });
      realSend(to, type, msg);
    }) as typeof social.send;
    const users = [];
    for (const n of names) users.push(ok(await accounts.create(n, 'motdepasse')));
    return { c, db, accounts, social, f: social.friends, sent, users };
  };

  it('sends a request, lists it on both sides, accepts it and removes the friend on both sides', async () => {
    const { f, users, sent } = await setup(['Alice', 'Bruno']);
    const [a, b] = users as [(typeof users)[0], (typeof users)[0]];
    expect(ok(f.request(a.token, 'bruno'))).toMatchObject({ status: 'pending' });
    expect(sent.filter((s) => s.type === 'friendsChanged').map((s) => s.to)).toEqual([a.account.id, b.account.id]);
    expect(ok(f.list(a.token))).toMatchObject({ friends: [], incoming: [], outgoing: [{ id: b.account.id, nickname: 'Bruno' }] });
    expect(ok(f.list(b.token))).toMatchObject({ friends: [], incoming: [{ id: a.account.id, nickname: 'Alice' }], outgoing: [] });
    // the sender cannot accept their own request
    expect(f.accept(a.token, b.account.id)).toMatchObject({ ok: false, status: 404 });
    ok(f.accept(b.token, a.account.id));
    expect(ok(f.list(a.token)).friends).toEqual([{ id: b.account.id, nickname: 'Bruno', presence: 'offline' }]);
    expect(ok(f.list(b.token)).friends).toEqual([{ id: a.account.id, nickname: 'Alice', presence: 'offline' }]);
    ok(f.remove(a.token, b.account.id));
    expect(ok(f.list(b.token))).toMatchObject({ friends: [], incoming: [], outgoing: [] });
    ok(f.remove(a.token, b.account.id)); // idempotent
  });

  it('accepts at once when the other player had already asked; declines and cancels remove the request', async () => {
    const { f, users } = await setup(['Alice', 'Bruno', 'Chloé']);
    const [a, b, c] = users as [(typeof users)[0], (typeof users)[0], (typeof users)[0]];
    ok(f.request(a.token, 'Bruno'));
    expect(ok(f.request(b.token, 'ALICE'))).toMatchObject({ status: 'accepted' });
    expect(ok(f.list(a.token)).friends.map((x) => x.nickname)).toEqual(['Bruno']);
    // decline
    ok(f.request(c.token, 'Alice'));
    ok(f.remove(a.token, c.account.id));
    expect(ok(f.list(c.token)).outgoing).toEqual([]);
    // cancel
    ok(f.request(c.token, 'Alice'));
    ok(f.remove(c.token, a.account.id));
    expect(ok(f.list(a.token)).incoming).toEqual([]);
  });

  it('answers clear errors', async () => {
    const { f, users } = await setup(['Alice', 'Bruno']);
    const [a] = users as [(typeof users)[0]];
    expect(f.request('faux', 'Bruno')).toMatchObject({ ok: false, status: 401, error: 'unauthorized' });
    expect(f.request(a.token, 'Personne')).toMatchObject({ ok: false, status: 404, error: 'unknown_player', message: 'Aucun joueur ne porte ce pseudo.' });
    expect(f.request(a.token, 42)).toMatchObject({ ok: false, status: 404, error: 'unknown_player' });
    expect(f.request(a.token, 'alice')).toMatchObject({ ok: false, status: 400, error: 'self' });
    ok(f.request(a.token, 'Bruno'));
    expect(f.request(a.token, 'Bruno')).toMatchObject({ ok: false, status: 409, error: 'already_requested' });
    ok(f.request(users[1]!.token, 'Alice'));
    expect(f.request(a.token, 'Bruno')).toMatchObject({ ok: false, status: 409, error: 'already_friends', message: 'Vous êtes déjà amis.' });
    expect(f.accept(a.token, 999)).toMatchObject({ ok: false, status: 404, error: 'not_found' });
    expect(f.list('faux')).toMatchObject({ ok: false, status: 401 });
  });

  it('allows 20 requests a minute, then asks to slow down', async () => {
    const { f, users, c } = await setup(['Alice']);
    const a = users[0]!;
    for (let i = 0; i < FRIEND_LIMITS.actionsPerMinute; i++) expect(f.request(a.token, `Nobody${i}`)).toMatchObject({ status: 404 });
    expect(f.request(a.token, 'Nobody')).toMatchObject({ ok: false, status: 429, error: 'slow_down', message: 'Doucement ! Réessaie dans un instant.' });
    c.t += 61_000;
    expect(f.request(a.token, 'Nobody')).toMatchObject({ status: 404 });
  });

  it('caps pending requests at 50 and friends at 100', async () => {
    const { f, users, db, c } = await setup(['Alice', 'Bruno']);
    const [a, b] = users as [(typeof users)[0], (typeof users)[0]];
    const insert = db.prepare("INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES (?, ?, NULL, 'x', 1)");
    const ids: number[] = [];
    for (let i = 0; i < 100; i++) ids.push(Number(insert.run(`P${i}`, `p${i}`).lastInsertRowid));
    const link = db.prepare('INSERT INTO friendships (a, b, requested_by, status, created_at) VALUES (?, ?, ?, ?, 1)');
    // 50 pending requests sent by Alice
    for (const id of ids.slice(0, 50)) link.run(Math.min(a.account.id, id), Math.max(a.account.id, id), a.account.id, 'pending');
    expect(f.request(a.token, 'Bruno')).toMatchObject({ ok: false, status: 409, error: 'limit_reached', message: 'Tu as déjà 50 demandes en attente.' });
    // Bruno has 100 friends
    for (const id of ids) link.run(Math.min(b.account.id, id), Math.max(b.account.id, id), id, 'accepted');
    c.t += 61_000;
    db.prepare('DELETE FROM friendships WHERE requested_by = ?').run(a.account.id);
    expect(f.request(a.token, 'Bruno')).toMatchObject({ ok: false, status: 409, error: 'limit_reached', message: 'Ce joueur a déjà 100 amis.' });
    expect(f.request(b.token, 'Alice')).toMatchObject({ ok: false, status: 409, error: 'limit_reached', message: 'Tu as déjà 100 amis : retires-en un d’abord.' });
  });

  it('presence: online counts connections, in game wins, each room clears its own flag', () => {
    const p = new PresenceRegistry();
    const seen: string[] = [];
    p.onChange((id, s) => seen.push(`${id}:${s}`));
    p.online(1);
    p.online(1); // a second tab
    p.offline(1);
    expect(p.of(1)).toBe('online');
    p.inGame(1, true, 'ROOM1');
    p.inGame(1, false, 'OTHER');
    expect(p.of(1)).toBe('inGame');
    p.inGame(1, false, 'ROOM1');
    p.offline(1);
    expect(p.of(1)).toBe('offline');
    expect(seen).toEqual(['1:online', '1:inGame', '1:online', '1:offline']);
  });
});

type Inbox = { [K in keyof HubServerMessages]: HubServerMessages[K][] };
const HUB_TYPES = ['friendPresence', 'friendsChanged', 'invite', 'inviteCancelled', 'inviteDeclined', 'inviteSent', 'inviteFailed'] as const;

describe('8.3 HTTP API and the hub room', () => {
  const port = 26770 + Math.floor(Math.random() * 100);
  const base = `http://localhost:${port}`;
  const url = `ws://localhost:${port}`;
  let ttl = 120_000;
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    server = await startServer(port, undefined, { dataDir: ':memory:', inviteTtlMs: () => ttl });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });
  const api = (method: string, path: string, token?: string, body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let n = 0;
  const account = async (prefix: string) => {
    const nickname = `${prefix}${Date.now() % 1e5}${n++}`;
    const r = (await (await api('POST', '/api/accounts', undefined, { nickname, password: 'motdepasse' })).json()) as { token: string; account: { id: number; nickname: string } };
    return { token: r.token, id: r.account.id, nickname };
  };
  const befriend = async (x: { token: string }, y: { token: string; nickname: string; id: number }, xId: number) => {
    expect((await api('POST', '/api/friends', (x as { token: string }).token, { nickname: y.nickname })).status).toBe(201);
    expect((await api('POST', `/api/friends/${xId}/accept`, y.token)).status).toBe(204);
  };
  const hub = async (token: string) => {
    const room = await new Client(url).joinOrCreate('hub', { session: token });
    const inbox = Object.fromEntries(HUB_TYPES.map((t) => [t, []])) as unknown as Inbox;
    for (const t of HUB_TYPES) room.onMessage(t, (m: never) => (inbox[t] as unknown[]).push(m));
    return { room, inbox };
  };
  const until = async (check: () => unknown, ms = 3000) => {
    const end = Date.now() + ms;
    while (!check()) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const friendsOf = async (token: string) => (await (await api('GET', '/api/friends', token)).json()) as FriendsList;
  const createRoom = async (token: string) => {
    const room = await new Client(url).create('duel', { mode: 'randomSplit', session: token });
    room.onMessage('view', () => {});
    const lobby = await new Promise<LobbyMessage>((res) => room.onMessage('lobby', res));
    return { room, code: lobby.code };
  };

  it('answers /api/health with friends, and the friend routes over HTTP', async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true, accounts: true, passkeys: true, friends: true, history: true, decks: true });
    const a = await account('Ha');
    const b = await account('Hb');
    expect((await api('GET', '/api/friends')).status).toBe(401);
    const unknown = await api('POST', '/api/friends', a.token, { nickname: 'Personne' });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'unknown_player', message: 'Aucun joueur ne porte ce pseudo.' });
    const r = await api('POST', '/api/friends', a.token, { nickname: b.nickname });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ status: 'pending' });
    expect((await friendsOf(b.token)).incoming).toEqual([{ id: a.id, nickname: a.nickname }]);
    expect((await api('POST', `/api/friends/${a.id}/accept`, b.token)).status).toBe(204);
    expect((await friendsOf(a.token)).friends).toEqual([{ id: b.id, nickname: b.nickname, presence: 'offline' }]);
    expect((await api('DELETE', `/api/friends/${b.id}`, a.token)).status).toBe(204);
    expect((await friendsOf(b.token)).friends).toEqual([]);
    expect((await api('POST', '/api/friends/abc/accept', a.token)).status).toBe(404);
  });

  it('refuses the hub without a valid session', async () => {
    await expect(new Client(url).joinOrCreate('hub', {})).rejects.toThrow();
    await expect(new Client(url).joinOrCreate('hub', { session: 'faux-jeton' })).rejects.toThrow();
  });

  it('shows presence live: online, in game, offline; and tells both sides when the list changes', async () => {
    const a = await account('Pa');
    const b = await account('Pb');
    const ha = await hub(a.token);
    expect((await api('POST', '/api/friends', a.token, { nickname: b.nickname })).status).toBe(201);
    await until(() => ha.inbox.friendsChanged.length === 1);
    const hb = await hub(b.token);
    expect((await api('POST', `/api/friends/${a.id}/accept`, b.token)).status).toBe(204);
    await until(() => ha.inbox.friendsChanged.length === 2 && hb.inbox.friendsChanged.length === 1);
    expect((await friendsOf(a.token)).friends[0]).toMatchObject({ id: b.id, presence: 'online' });
    // a second tab does not change anything; closing one of two keeps B online
    const hb2 = await hub(b.token);
    await hb2.room.leave(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(ha.inbox.friendPresence).toEqual([]);
    // B plays a duel against a guest: orange
    const { room: duel, code } = await createRoom(b.token);
    const guest = await new Client(url).joinById(code, { nickname: 'Invité' });
    guest.onMessage('lobby', () => {});
    guest.onMessage('view', () => {});
    await until(() => ha.inbox.friendPresence.length === 1);
    expect(ha.inbox.friendPresence[0]).toEqual({ id: b.id, presence: 'inGame' });
    expect((await friendsOf(a.token)).friends[0]!.presence).toBe('inGame');
    // the duel ends: green again
    guest.send('action', { type: 'concede', player: 1 });
    await until(() => ha.inbox.friendPresence.length === 2);
    expect(ha.inbox.friendPresence[1]).toEqual({ id: b.id, presence: 'online' });
    await guest.leave(true);
    await duel.leave(true);
    await hb.room.leave(true);
    await until(() => ha.inbox.friendPresence.length === 3);
    expect(ha.inbox.friendPresence[2]).toEqual({ id: b.id, presence: 'offline' });
    await ha.room.leave(true);
  }, 20000);

  it('delivers an invitation live, tells the inviter about a refusal, and cancels it when the room starts', async () => {
    const a = await account('Ia');
    const b = await account('Ib');
    await befriend(a, b, a.id);
    const ha = await hub(a.token);
    const hb = await hub(b.token);
    const { room, code } = await createRoom(a.token);
    ha.room.send('invite', { friendId: b.id, roomCode: code });
    await until(() => hb.inbox.invite.length === 1 && ha.inbox.inviteSent.length === 1);
    const inv = hb.inbox.invite[0]!;
    expect(inv).toMatchObject({ from: { id: a.id, nickname: a.nickname }, roomCode: code, mode: 'randomSplit' });
    expect(inv.msLeft).toBeGreaterThan(119_000);
    expect(ha.inbox.inviteSent[0]).toMatchObject({ inviteId: inv.inviteId, to: { id: b.id, nickname: b.nickname }, roomCode: code });
    // a tab opened later still gets it
    const hb2 = await hub(b.token);
    await until(() => hb2.inbox.invite.length === 1);
    await hb2.room.leave(true);
    // B refuses
    hb.room.send('declineInvite', { inviteId: inv.inviteId });
    await until(() => ha.inbox.inviteDeclined.length === 1);
    expect(ha.inbox.inviteDeclined[0]).toEqual({ inviteId: inv.inviteId, by: { id: b.id, nickname: b.nickname } });
    // invited again, B joins: the room starts and the invitation goes
    ha.room.send('invite', { friendId: b.id, roomCode: code });
    await until(() => hb.inbox.invite.length === 2);
    const second = hb.inbox.invite[1]!;
    const joined = await new Client(url).joinById(code, { session: b.token });
    joined.onMessage('view', () => {});
    const lobby = await new Promise<LobbyMessage>((res) => joined.onMessage('lobby', res));
    expect(lobby.seats).toEqual([a.nickname, b.nickname]);
    await until(() => hb.inbox.inviteCancelled.some((c) => c.inviteId === second.inviteId));
    expect(hb.inbox.inviteCancelled.find((c) => c.inviteId === second.inviteId)!.reason).toBe('started');
    expect(ha.inbox.inviteCancelled.find((c) => c.inviteId === second.inviteId)!.reason).toBe('started');
    // B is now in a game: cannot be invited
    const other = await createRoom(a.token);
    ha.room.send('invite', { friendId: b.id, roomCode: other.code });
    await until(() => ha.inbox.inviteFailed.length === 1);
    expect(ha.inbox.inviteFailed[0]).toMatchObject({ friendId: b.id, error: 'in_game', message: 'Ton ami est en pleine partie.' });
    joined.send('action', { type: 'concede', player: 1 });
    await new Promise((r) => setTimeout(r, 100));
    for (const r of [joined, room, other.room, ha.room, hb.room]) await r.leave(true);
  }, 20000);

  it('expires an invitation, cancels it when the room goes or the inviter takes it back', async () => {
    const a = await account('Ea');
    const b = await account('Eb');
    await befriend(a, b, a.id);
    const ha = await hub(a.token);
    const hb = await hub(b.token);
    const { room, code } = await createRoom(a.token);
    ttl = 300;
    try {
      ha.room.send('invite', { friendId: b.id, roomCode: code });
      await until(() => hb.inbox.invite.length === 1);
      await until(() => hb.inbox.inviteCancelled.length === 1);
      expect(hb.inbox.inviteCancelled[0]).toEqual({ inviteId: hb.inbox.invite[0]!.inviteId, reason: 'expired' });
      expect(ha.inbox.inviteCancelled[0]!.reason).toBe('expired');
    } finally {
      ttl = 120_000;
    }
    ha.room.send('invite', { friendId: b.id, roomCode: code });
    await until(() => ha.inbox.inviteSent.length === 2);
    ha.room.send('cancelInvite', { inviteId: ha.inbox.inviteSent[1]!.inviteId });
    await until(() => hb.inbox.inviteCancelled.length === 2);
    expect(hb.inbox.inviteCancelled[1]!.reason).toBe('cancelled');
    // a new invitation replaces the previous one
    ha.room.send('invite', { friendId: b.id, roomCode: code });
    ha.room.send('invite', { friendId: b.id, roomCode: code });
    await until(() => hb.inbox.invite.length === 4 && hb.inbox.inviteCancelled.length === 3);
    expect(hb.inbox.inviteCancelled[2]).toEqual({ inviteId: hb.inbox.invite[2]!.inviteId, reason: 'cancelled' });
    // the creator leaves the waiting room: the invitation goes
    await room.leave(true);
    await until(() => hb.inbox.inviteCancelled.length === 4);
    expect(hb.inbox.inviteCancelled[3]).toEqual({ inviteId: hb.inbox.invite[3]!.inviteId, reason: 'gone' });
    await ha.room.leave(true);
    await hb.room.leave(true);
  }, 20000);

  it('refuses to invite a non-friend, an offline friend, or to a room the inviter does not own', async () => {
    const a = await account('Ra');
    const b = await account('Rb');
    const c = await account('Rc');
    await befriend(a, b, a.id);
    const ha = await hub(a.token);
    const hc = await hub(c.token);
    const { room, code } = await createRoom(a.token);
    ha.room.send('invite', { friendId: c.id, roomCode: code });
    await until(() => ha.inbox.inviteFailed.length === 1);
    expect(ha.inbox.inviteFailed[0]).toMatchObject({ friendId: c.id, error: 'not_friends' });
    ha.room.send('invite', { friendId: b.id, roomCode: code });
    await until(() => ha.inbox.inviteFailed.length === 2);
    expect(ha.inbox.inviteFailed[1]).toMatchObject({ error: 'offline', message: 'Ton ami n’est plus en ligne.' });
    const hb = await hub(b.token);
    const foreign = await createRoom(c.token);
    ha.room.send('invite', { friendId: b.id, roomCode: foreign.code });
    ha.room.send('invite', { friendId: b.id, roomCode: 'ZZZZZ' });
    await until(() => ha.inbox.inviteFailed.length === 4);
    expect(ha.inbox.inviteFailed.slice(2).map((f) => f.error)).toEqual(['room_gone', 'room_gone']);
    expect(hb.inbox.invite).toEqual([]);
    expect(hc.inbox.invite).toEqual([]);
    for (const r of [room, foreign.room, ha.room, hb.room, hc.room] as Room[]) await r.leave(true);
  }, 20000);
});
