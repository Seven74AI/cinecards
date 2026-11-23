#!/usr/bin/env node
/**
 * Story 8.7: live smoke test of a running CineCards server, without a browser (Colyseus SDK + fetch).
 * On the VPS, autodeploy runs it inside the game container after each deploy, against http://localhost:2567:
 *
 *   docker compose exec -T -e SMOKE_COMMIT=<sha> server node --experimental-transform-types --no-warnings scripts/smoke.mjs
 *   pnpm smoke                                       # locally, against `pnpm dev:server`
 *
 * Steps, in order, each timed: health, the two fixed test accounts (`ZZ-fumee-a`, `ZZ-fumee-b`, created on the
 * first run and reused), their friendship, hub presence, a live invitation from A to B, the duel start, an emote,
 * B's concession, A's history, one valid deck per account and a constructed room started then conceded.
 * The first failing step stops the run (rooms are left, sessions closed). Global limit: 60 s.
 *
 * Environment: SMOKE_URL (default http://localhost:2567), DATA_DIR (default apps/server/data, `/app/data` in
 * Docker), CONTENT_DIR (the card sets, for the playable cards of the decks), SMOKE_COMMIT (shown in the result).
 * Writes DATA_DIR/smoke.json (`GET /api/smoke`, no secret in it); the passwords stay in DATA_DIR/smoke-accounts.json.
 * Exit code 0 when every step passes, 1 otherwise. Needs `--experimental-transform-types` (it reads the card
 * catalog through the engine's TypeScript sources).
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// the script sits at the repository root, whose node_modules has no server packages: resolve them as the server does
const fromServer = createRequire(join(ROOT, 'apps/server/package.json'));
const load = (spec) => import(pathToFileURL(fromServer.resolve(spec)).href);

const BASE = (process.env.SMOKE_URL ?? 'http://localhost:2567').replace(/\/$/, '');
const WS = BASE.replace(/^http/, 'ws');
const DATA_DIR = process.env.DATA_DIR ?? join(ROOT, 'apps/server/data');
const CONTENT_DIR = process.env.CONTENT_DIR ?? join(ROOT, 'content/sets');
const RESULT_FILE = join(DATA_DIR, 'smoke.json');
const ACCOUNTS_FILE = join(DATA_DIR, 'smoke-accounts.json');
const TOTAL_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 60_000);
const WAIT_MS = 10_000;
/** Fixed nicknames: `ZZ-` sorts them last and tells players they are not real people (AC 5). */
const SMOKE_NICKNAMES = ['ZZ-fumee-a', 'ZZ-fumee-b'];
const DECK_NAME = 'Fumée';

const startedAt = Date.now();
const deadline = startedAt + TOTAL_MS;
const steps = [];
const rooms = [];
const sessions = [];

const commit = () => {
  if (process.env.SMOKE_COMMIT) return process.env.SMOKE_COMMIT.slice(0, 40);
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
};

class SmokeError extends Error {}
const fail = (message) => {
  throw new SmokeError(message);
};

/** Rejects once the global limit is reached. */
const inTime = (promise) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new SmokeError(`délai global de ${TOTAL_MS / 1000} s dépassé`)), Math.max(0, deadline - Date.now()));
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });

const until = async (check, what, ms = WAIT_MS) => {
  const end = Math.min(Date.now() + ms, deadline);
  for (;;) {
    const v = await check();
    if (v) return v;
    if (Date.now() > end) fail(`attendu en vain : ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
};

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(Math.max(1, Math.min(WAIT_MS, deadline - Date.now()))),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/** The response's own error code and message only: never a token or a password. */
const why = (r) => `${r.status}${r.json?.error ? ` ${r.json.error}` : ''}${r.json?.message ? ` (${r.json.message})` : ''}`;
const expectStatus = (r, status, what) => {
  if (r.status !== status) fail(`${what} : ${why(r)}`);
  return r.json;
};

const MESSAGE_TYPES = {
  duel: ['lobby', 'view', 'rejected', 'away', 'emote', 'deckRefused'],
  hub: ['friendPresence', 'friendsChanged', 'invite', 'inviteCancelled', 'inviteDeclined', 'inviteSent', 'inviteFailed'],
};

/** Joins a room and records every message by type. */
async function open(kind, join) {
  const room = await inTime(join());
  rooms.push(room);
  const inbox = Object.fromEntries(MESSAGE_TYPES[kind].map((t) => [t, []]));
  for (const t of MESSAGE_TYPES[kind]) room.onMessage(t, (m) => inbox[t].push(m));
  return { room, inbox };
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const out = await inTime(Promise.resolve().then(fn));
    steps.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ok   ${name} (${Date.now() - t0} ms)`);
    return out;
  } catch (err) {
    const error = String(err instanceof Error ? err.message : err).slice(0, 300);
    steps.push({ name, ok: false, ms: Date.now() - t0, error });
    console.log(`  FAIL ${name} (${Date.now() - t0} ms): ${error}`);
    throw new SmokeError(name);
  }
}

function writeAtomic(file, text, mode) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode });
  renameSync(tmp, file);
}

/** The test accounts' passwords, made up on the first run and kept next to the database (never in the result). */
function smokeCredentials() {
  if (existsSync(ACCOUNTS_FILE)) {
    const saved = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));
    if (Array.isArray(saved.accounts) && saved.accounts.length === 2 && saved.accounts.every((a) => typeof a.password === 'string')) return saved.accounts;
  }
  const accounts = SMOKE_NICKNAMES.map((nickname) => ({ nickname, password: randomBytes(18).toString('base64url') }));
  writeAtomic(ACCOUNTS_FILE, `${JSON.stringify({ accounts }, null, 2)}\n`, 0o600);
  return accounts;
}

async function signIn({ nickname, password }) {
  let r = await api('POST', '/api/sessions', undefined, { nickname, password });
  if (r.status === 401) {
    r = await api('POST', '/api/accounts', undefined, { nickname, password });
    if (r.status === 409) fail(`le compte ${nickname} existe mais son mot de passe n’est pas celui de smoke-accounts.json`);
    expectStatus(r, 201, `création de ${nickname}`);
  } else expectStatus(r, 200, `connexion de ${nickname}`);
  sessions.push(r.json.token);
  return { token: r.json.token, id: r.json.account.id, nickname: r.json.account.nickname };
}

const friendsOf = async (who) => expectStatus(await api('GET', '/api/friends', who.token), 200, `amis de ${who.nickname}`);

async function befriend(a, b) {
  const list = await friendsOf(a);
  if (list.friends.some((f) => f.id === b.id)) return 'déjà amis';
  if (list.incoming.some((f) => f.id === b.id)) {
    expectStatus(await api('POST', `/api/friends/${b.id}/accept`, a.token), 204, 'acceptation par A');
  } else {
    if (!list.outgoing.some((f) => f.id === b.id)) expectStatus(await api('POST', '/api/friends', a.token, { nickname: b.nickname }), 201, 'demande d’ami de A');
    expectStatus(await api('POST', `/api/friends/${a.id}/accept`, b.token), 204, 'acceptation par B');
  }
  const after = await friendsOf(a);
  if (!after.friends.some((f) => f.id === b.id)) fail('B n’est pas dans les amis de A');
  return 'amitié créée';
}

/** One valid deck named "Fumée" per account: kept if it still plays, its cards replaced if not, created if absent. */
async function ensureDeck(who, cards) {
  const { decks } = expectStatus(await api('GET', '/api/decks', who.token), 200, `decks de ${who.nickname}`);
  const mine = decks.find((d) => d.name === DECK_NAME);
  if (mine?.valid) return mine;
  const r = mine ? await api('PUT', `/api/decks/${mine.id}`, who.token, { cards }) : await api('POST', '/api/decks', who.token, { name: DECK_NAME, cards });
  const { deck } = expectStatus(r, mine ? 200 : 201, `deck de ${who.nickname}`);
  if (!deck.valid) fail(`deck de ${who.nickname} refusé : ${deck.errors.join(' ; ')}`);
  return deck;
}

/** A creates a duel room; returns it with its code and A's seat. */
async function createDuel(Client, a, options) {
  const host = await open('duel', () => new Client(WS).create('duel', { session: a.token, ...options }));
  const lobby = await until(() => host.inbox.lobby.at(-1), 'la salle d’attente');
  return { ...host, code: lobby.code, seat: lobby.you };
}

async function main() {
  const { Client } = await load('@colyseus/sdk');
  let a;
  let b;
  let duel;
  let guest;
  let duelStartedAt;
  await step('health', async () => {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(WAIT_MS) });
    if (!r.ok || (await r.text()) !== 'ok') fail(`/health : ${r.status}`);
    expectStatus(await api('GET', '/api/health'), 200, '/api/health');
  });
  await step('accounts', async () => {
    const creds = smokeCredentials();
    a = await signIn(creds[0]);
    b = await signIn(creds[1]);
  });
  await step('friends', () => befriend(a, b));
  const hubs = await step('presence', async () => {
    const ha = await open('hub', () => new Client(WS).joinOrCreate('hub', { session: a.token }));
    const hb = await open('hub', () => new Client(WS).joinOrCreate('hub', { session: b.token }));
    await until(async () => (await friendsOf(a)).friends.find((f) => f.id === b.id)?.presence === 'online', 'B en ligne pour A');
    return { ha, hb };
  });
  await step('invite', async () => {
    duel = await createDuel(Client, a, { mode: 'randomSplit' });
    hubs.ha.room.send('invite', { friendId: b.id, roomCode: duel.code });
    await until(() => {
      const failed = hubs.ha.inbox.inviteFailed.find((f) => f.roomCode === duel.code);
      if (failed) fail(`invitation refusée : ${failed.error} (${failed.message})`);
      return hubs.hb.inbox.invite.some((i) => i.roomCode === duel.code && i.from.id === a.id);
    }, 'l’invitation reçue par B');
  });
  await step('duel', async () => {
    guest = await open('duel', () => new Client(WS).joinById(duel.code, { session: b.token }));
    duelStartedAt = Date.now();
    await until(() => duel.inbox.view.length > 0 && guest.inbox.view.length > 0, 'les vues du duel des deux côtés');
    const lobby = guest.inbox.lobby.at(-1);
    if (!lobby || lobby.seats[0] !== a.nickname || lobby.seats[1] !== b.nickname) fail('les places ne sont pas A puis B');
    guest.seat = lobby.you;
  });
  await step('emote', async () => {
    duel.room.send('emote', { id: 'gg' });
    await until(() => guest.inbox.emote.some((e) => e.id === 'gg' && e.from === duel.seat), 'l’émote chez B');
  });
  await step('concede', async () => {
    guest.room.send('action', { type: 'concede', player: guest.seat });
    await until(() => duel.inbox.view.some((v) => v.view.state.winner === duel.seat), 'la fin de la partie chez A');
  });
  await step('history', async () => {
    await until(async () => {
      const { games } = expectStatus(await api('GET', '/api/history', a.token), 200, 'historique de A');
      const g = games[0];
      return g && g.opponent.nickname === b.nickname && g.result === 'opponent_conceded' && g.endedAt >= duelStartedAt - 5000;
    }, 'la partie dans l’historique de A');
    for (const r of [duel.room, guest.room]) await r.leave(true).catch(() => {});
  });
  const decks = await step('decks', async () => {
    const { loadSetsFromDir } = await load('@cinecards/cards/node');
    const { playableCardIds } = await load('@cinecards/engine');
    const playable = playableCardIds(loadSetsFromDir(CONTENT_DIR).catalog).sort();
    if (playable.length < 50) fail(`seulement ${playable.length} cartes jouables`);
    return { a: await ensureDeck(a, playable.slice(0, 50)), b: await ensureDeck(b, playable.slice(-50)) };
  });
  await step('constructed', async () => {
    const host = await createDuel(Client, a, { mode: 'constructed', deckId: decks.a.id });
    const other = await open('duel', () => new Client(WS).joinById(host.code, { session: b.token, deckId: decks.b.id, pickDeck: true }));
    await until(() => {
      const refused = [...host.inbox.deckRefused, ...other.inbox.deckRefused][0];
      if (refused) fail(`deck refusé : ${refused.message}`);
      return host.inbox.view.length > 0 && other.inbox.view.length > 0;
    }, 'le début de la partie en decks construits');
    const state = host.inbox.view.at(-1).view.state;
    if (state.mode !== 'constructed') fail(`mode ${state.mode} au lieu de constructed`);
    const seat = other.inbox.lobby.at(-1).you;
    other.room.send('action', { type: 'concede', player: seat });
    await until(() => host.inbox.view.some((v) => v.view.state.winner === host.seat), 'l’abandon en decks construits');
  });
}

async function cleanup() {
  for (const r of rooms) await Promise.race([r.leave(true).catch(() => {}), new Promise((res) => setTimeout(res, 1000))]);
  for (const token of sessions) await api('DELETE', '/api/sessions/current', token).catch(() => {});
}

let ok = true;
try {
  await main();
} catch (err) {
  ok = false;
  if (!(err instanceof SmokeError)) {
    steps.push({ name: 'script', ok: false, ms: 0, error: String(err instanceof Error ? err.message : err).slice(0, 300) });
    console.log(`  FAIL script: ${steps.at(-1).error}`);
  }
}
await cleanup().catch(() => {});
const result = { ok, commit: commit(), startedAt: new Date(startedAt).toISOString(), durationMs: Date.now() - startedAt, steps };
try {
  writeAtomic(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 0o644);
} catch (err) {
  console.log(`  (résultat non écrit dans ${RESULT_FILE} : ${err instanceof Error ? err.message : err})`);
}
const failed = steps.find((s) => !s.ok);
console.log(ok ? `smoke OK (${steps.length} étapes, ${result.durationMs} ms)` : `smoke FAILED (${failed?.name ?? '?'}: ${failed?.error ?? ''})`);
process.exit(ok ? 0 : 1);
