import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { matchMaker } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { playableCardIds, type GameState } from '@cinecards/engine';
import { DECK_REFUSED_CODE, type DeckRefusedMessage, type LobbyMessage, type ViewMessage } from '@cinecards/protocol';
import type { HistoryList } from './history.ts';
import { startServer } from './main.ts';
import { CONSTRUCTED_MESSAGES } from './room.ts';

/** Story 10.3: choosing a saved deck for an online room. */

const { catalog } = loadSetsFromDir(fileURLToPath(new URL('../../../content/sets', import.meta.url)));
const PLAYABLE = playableCardIds(catalog).sort();
/** Two different valid decks (51 playable cards: each leaves one out). */
const DECK_A = PLAYABLE.slice(0, 50);
const DECK_B = PLAYABLE.slice(-50);

describe('10.3 constructed rooms', () => {
  const port = 27970 + Math.floor(Math.random() * 100);
  const base = `http://localhost:${port}`;
  const url = `ws://localhost:${port}`;
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    server = await startServer(port, undefined, { dataDir: ':memory:' });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });

  let n = 0;
  const api = (method: string, path: string, token?: string, body?: unknown) =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const account = async (prefix: string) => {
    const nickname = `${prefix}${Date.now() % 1e5}${n++}`;
    const body = (await (await api('POST', '/api/accounts', undefined, { nickname, password: 'motdepasse' })).json()) as { token: string; account: { id: number } };
    return { token: body.token, id: body.account.id, nickname };
  };
  const saveDeck = async (token: string, cards: string[], name = 'Mon deck') => ((await (await api('POST', '/api/decks', token, { name, cards })).json()) as { deck: { id: number; valid: boolean } }).deck;
  const until = async (check: () => unknown, ms = 4000) => {
    const end = Date.now() + ms;
    while (!(await check())) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 30));
    }
  };
  /** A room with its latest lobby, views and refusals. */
  const watch = (r: Room) => {
    const w = { lobby: null as LobbyMessage | null, views: [] as ViewMessage[], refused: [] as string[] };
    r.onMessage('lobby', (m: LobbyMessage) => (w.lobby = m));
    r.onMessage('view', (m: ViewMessage) => w.views.push(m));
    r.onMessage('deckRefused', (m: DeckRefusedMessage) => w.refused.push(m.message));
    r.onMessage('emote', () => {});
    r.onMessage('away', () => {});
    return w;
  };
  const leaveAll = async (...rooms: Room[]) => {
    for (const r of rooms) await r.leave(true).catch(() => {});
  };
  const serverState = (code: string) => (matchMaker.getLocalRoomById(code) as unknown as { duel: { state: GameState } | null }).duel?.state ?? null;
  const ownCards = (s: GameState, p: 0 | 1) =>
    Object.values(s.instances)
      .filter((i) => i.owner === p)
      .map((i) => i.cardId)
      .sort();

  it('two accounts: each draws from their own deck, the guest picks in the waiting room, the opponent deck stays hidden', async () => {
    const a = await account('Ka');
    const b = await account('Kb');
    const da = await saveDeck(a.token, DECK_A);
    const db = await saveDeck(b.token, DECK_B);
    expect(da.valid && db.valid).toBe(true);
    const r0 = await new Client(url).create('duel', { mode: 'constructed', session: a.token, deckId: da.id });
    const w0 = watch(r0);
    await until(() => w0.lobby);
    expect(w0.lobby).toMatchObject({ mode: 'constructed', needDeck: false, deckChosen: [true, false], deckId: da.id });
    const code = w0.lobby!.code;
    const r1 = await new Client(url).joinById(code, { session: b.token, pickDeck: true });
    const w1 = watch(r1);
    await until(() => w1.lobby);
    expect(w1.lobby).toMatchObject({ mode: 'constructed', needDeck: true, deckChosen: [true, false], deckId: null });
    expect(serverState(code)).toBeNull(); // waits for the second deck
    // someone else's deck is refused, and so is a made-up id
    r1.send('chooseDeck', { deckId: da.id });
    r1.send('chooseDeck', { deckId: 999999 });
    await until(() => w1.refused.length === 2);
    expect(w1.refused[0]).toMatch(/n’existe plus/);
    expect(serverState(code)).toBeNull();
    r1.send('chooseDeck', { deckId: db.id });
    await until(() => w0.views.length > 0 && w1.views.length > 0);
    const s = serverState(code)!;
    expect(s.mode).toBe('constructed');
    expect(ownCards(s, 0)).toEqual([...DECK_A].sort());
    expect(ownCards(s, 1)).toEqual([...DECK_B].sort());
    for (const [w, me] of [
      [w0, 0],
      [w1, 1],
    ] as const) {
      const v = w.views.at(-1)!.view.state;
      const P = v.players[me];
      expect(P.deck.length + P.hand.length).toBe(50);
      const mine = me === 0 ? DECK_A : DECK_B;
      for (const iid of P.hand) expect(mine).toContain(v.instances[iid]!.cardId);
      // nothing of the opponent's deck or hand reaches this seat at the start
      expect(Object.values(v.instances).filter((i) => i.owner !== me)).toEqual([]);
    }
    // the saved deck changes after the start: the running game keeps its copy
    await api('PUT', `/api/decks/${da.id}`, a.token, { cards: DECK_B });
    expect(ownCards(serverState(code)!, 0)).toEqual([...DECK_A].sort());
    // story 8.4: the history says "constructed"
    r1.send('action', { type: 'concede', player: 1 });
    const hist = async () => ((await (await api('GET', '/api/history', a.token)).json()) as HistoryList).games;
    await until(async () => (await hist()).length === 1);
    expect((await hist())[0]).toMatchObject({ mode: 'constructed', result: 'opponent_conceded' });
    await leaveAll(r0, r1);
  });

  it('a second player can bring a deck id on joining', async () => {
    const a = await account('Ja');
    const b = await account('Jb');
    const da = await saveDeck(a.token, DECK_A);
    const db = await saveDeck(b.token, DECK_B);
    const r0 = await new Client(url).create('duel', { mode: 'constructed', session: a.token, deckId: da.id });
    const w0 = watch(r0);
    await until(() => w0.lobby);
    const r1 = await new Client(url).joinById(w0.lobby!.code, { session: b.token, deckId: db.id });
    const w1 = watch(r1);
    await until(() => w0.views.length > 0 && w1.views.length > 0);
    expect(ownCards(serverState(w0.lobby!.code)!, 1)).toEqual([...DECK_B].sort());
    await leaveAll(r0, r1);
  });

  it('refuses a guest, an account without a valid deck and an older client, with a French message, and keeps the seat free', async () => {
    const a = await account('Ra');
    const da = await saveDeck(a.token, DECK_A);
    const r0 = await new Client(url).create('duel', { mode: 'constructed', session: a.token, deckId: da.id });
    const w0 = watch(r0);
    await until(() => w0.lobby);
    const code = w0.lobby!.code;
    const refusal = (p: Promise<unknown>) => p.then(() => null, (e: { code?: number; message?: string }) => e);
    const guest = await refusal(new Client(url).joinById(code, { nickname: 'Invité', pickDeck: true }));
    expect(guest).toMatchObject({ code: DECK_REFUSED_CODE, message: CONSTRUCTED_MESSAGES.join });
    const empty = await account('Rb');
    await saveDeck(empty.token, DECK_B.slice(0, 20)); // incomplete: not a deck to play
    expect(await refusal(new Client(url).joinById(code, { session: empty.token, pickDeck: true }))).toMatchObject({ message: CONSTRUCTED_MESSAGES.join });
    // an older client sends neither a deck nor `pickDeck`, even with an account that has a valid deck
    const old = await account('Rc');
    await saveDeck(old.token, DECK_B);
    expect(await refusal(new Client(url).joinById(code, { session: old.token }))).toMatchObject({ message: CONSTRUCTED_MESSAGES.join });
    expect(w0.lobby!.seats[1]).toBeNull();
    // the seat is still free for a player who can play
    const r1 = await new Client(url).joinById(code, { session: old.token, pickDeck: true });
    const w1 = watch(r1);
    await until(() => w1.lobby?.needDeck);
    await leaveAll(r0, r1);
  });

  it('refuses to create a constructed room without an account or with an invalid deck', async () => {
    const refusal = (p: Promise<unknown>) => p.then(() => null, (e: { code?: number; message?: string }) => e);
    expect(await refusal(new Client(url).create('duel', { mode: 'constructed', nickname: 'Invité', deckId: 1 }))).toMatchObject({ code: DECK_REFUSED_CODE, message: CONSTRUCTED_MESSAGES.signIn });
    const a = await account('Ca');
    const b = await account('Cb');
    const half = await saveDeck(a.token, DECK_A.slice(0, 30));
    const other = await saveDeck(b.token, DECK_B);
    expect(await refusal(new Client(url).create('duel', { mode: 'constructed', session: a.token, deckId: half.id }))).toMatchObject({ message: expect.stringMatching(/plus valide : Il manque 20 cartes/) });
    expect(await refusal(new Client(url).create('duel', { mode: 'constructed', session: a.token, deckId: other.id }))).toMatchObject({ message: expect.stringMatching(/n’existe plus/) });
    expect(await refusal(new Client(url).create('duel', { mode: 'constructed', session: a.token }))).toMatchObject({ code: DECK_REFUSED_CODE });
  });

  it('a deck deleted in the waiting room is caught at the start', async () => {
    const a = await account('Da');
    const b = await account('Db');
    const da = await saveDeck(a.token, DECK_A);
    const db = await saveDeck(b.token, DECK_B);
    const r0 = await new Client(url).create('duel', { mode: 'constructed', session: a.token, deckId: da.id });
    const w0 = watch(r0);
    await until(() => w0.lobby);
    const r1 = await new Client(url).joinById(w0.lobby!.code, { session: b.token, pickDeck: true });
    const w1 = watch(r1);
    await until(() => w1.lobby);
    await api('DELETE', `/api/decks/${da.id}`, a.token);
    r1.send('chooseDeck', { deckId: db.id });
    await until(() => w0.refused.length === 1);
    expect(serverState(w0.lobby!.code)).toBeNull();
    await until(() => w0.lobby!.needDeck === true && w0.lobby!.deckChosen![1]);
    const again = await saveDeck(a.token, DECK_A);
    r0.send('chooseDeck', { deckId: again.id });
    await until(() => w0.views.length > 0);
    await leaveAll(r0, r1);
  });

  it('older clients keep their modes: no deck fields, shared or randomSplit', async () => {
    for (const mode of [undefined, 'shared', 'randomSplit'] as const) {
      const r0 = await new Client(url).create('duel', mode ? { mode, nickname: 'Vieux' } : { nickname: 'Vieux' });
      const w0 = watch(r0);
      await until(() => w0.lobby);
      expect(w0.lobby!.mode).toBe(mode ?? 'shared');
      expect(w0.lobby).not.toHaveProperty('needDeck');
      const r1 = await new Client(url).joinById(w0.lobby!.code, { nickname: 'Autre' });
      watch(r1);
      await until(() => w0.views.length > 0);
      expect(w0.views[0]!.view.state.mode).toBe(mode ?? 'shared');
      await leaveAll(r0, r1);
    }
  });
});
