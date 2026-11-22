import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { Client } from '@colyseus/sdk';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { createGame, type PlayerId } from '@cinecards/engine';
import type { LobbyMessage, ViewMessage } from '@cinecards/protocol';
import { Duel, type Clock } from './duel.ts';
import { redactEvents, redactState } from './redact.ts';
import { roomCode } from './codes.ts';
import { startServer } from './main.ts';
import { roomConfig } from './room.ts';

const { catalog } = loadSetsFromDir(fileURLToPath(new URL('../../../content/sets', import.meta.url)));

class FakeClock implements Clock {
  t = 1000;
  timers: { at: number; fn: () => void; id: number }[] = [];
  private n = 0;
  now = () => this.t;
  setTimeout = (fn: () => void, ms: number) => {
    const id = ++this.n;
    this.timers.push({ at: this.t + ms, fn, id });
    return id;
  };
  clearTimeout = (h: unknown) => {
    this.timers = this.timers.filter((x) => x.id !== h);
  };
  advance(ms: number) {
    this.t += ms;
    for (;;) {
      const due = this.timers.filter((x) => x.at <= this.t).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((x) => x !== due);
      due.fn();
    }
  }
}

describe('6.2 room codes', () => {
  it('uses 5 unambiguous characters', () => {
    const c = roomCode();
    expect(c).toMatch(/^[A-HJKMNP-Z2-9]{5}$/);
  });
});

describe('6.3 redacted views', () => {
  it('hides the opponent hand, the piles and the RNG', () => {
    const { state } = createGame(catalog, { seed: 4, mode: 'randomSplit' });
    const v = redactState(state, 0);
    expect(v.players[0].hand).toEqual(state.players[0].hand);
    expect(v.players[1].hand).toHaveLength(state.players[1].hand.length);
    for (const iid of v.players[1].hand) expect(v.instances[iid]).toBeUndefined();
    for (const iid of [...v.players[0].deck, ...v.players[1].deck]) expect(v.instances[iid]).toBeUndefined();
    expect(v.rng).toBe(0);
    expect(JSON.stringify(v)).not.toContain(`"${state.players[1].hand[0]}"`);
    const ev = redactEvents([{ type: 'cardDrawn', player: 1, iid: 'c9' }], 0);
    expect(ev[0]).toMatchObject({ iid: '?' });
  });
});

describe('6.4 / 6.5 timers', () => {
  it('ends the turn when the 75 s timer runs out and auto-passes a reaction after 5 s', () => {
    const clock = new FakeClock();
    const views: Record<PlayerId, ViewMessage[]> = { 0: [], 1: [] };
    const duel = new Duel(catalog, { seed: 3, mode: 'shared' }, ['A', 'B'], { view: (p, m) => views[p].push(m), rejected: () => {} }, clock);
    const first = duel.state.active;
    expect(views[0][0]!.turnEndsAt).toBe(1000 + 75000);
    clock.advance(75000);
    expect(duel.state.active).not.toBe(first);
    // force a reaction window and check the 5 s auto-pass
    duel.state.pending = { kind: 'reaction', player: first, options: [], key: 'x' };
    (duel as unknown as { armTimers(n: boolean): void }).armTimers(false);
    expect(duel.reactionEndsAt).toBe(clock.t + 5000);
    clock.advance(5000);
    expect(duel.state.pending).toBeNull();
    duel.dispose();
  });

  it('rejects actions sent for the wrong seat with a typed error', () => {
    const rejected: string[] = [];
    const duel = new Duel(catalog, { seed: 3, mode: 'shared' }, ['A', 'B'], { view: () => {}, rejected: (_p, e) => rejected.push(e.code) }, new FakeClock());
    const idle: PlayerId = duel.state.active === 0 ? 1 : 0;
    duel.act(idle, { type: 'endTurn', player: duel.state.active });
    expect(rejected).toEqual(['NOT_YOUR_TURN']);
  });
});

describe('6.1 / 6.6 duel room over WebSocket', () => {
  const port = 25670 + Math.floor(Math.random() * 100);
  let server: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    roomConfig.reconnectSeconds = 2;
    server = await startServer(port);
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });

  it('two players join by code, receive their own views and play', async () => {
    const a = new Client(`ws://localhost:${port}`);
    const b = new Client(`ws://localhost:${port}`);
    const roomA = await a.create('duel', { mode: 'shared', nickname: 'Root' });
    const lobby = await new Promise<LobbyMessage>((res) => roomA.onMessage('lobby', res));
    expect(lobby.code).toBe(roomA.roomId);
    const viewsA: ViewMessage[] = [];
    const viewsB: ViewMessage[] = [];
    roomA.onMessage('view', (m: ViewMessage) => viewsA.push(m));
    const roomB = await b.joinById(roomA.roomId, { nickname: 'Ami' });
    roomB.onMessage('view', (m: ViewMessage) => viewsB.push(m));
    roomB.onMessage('lobby', () => {});
    await new Promise((r) => setTimeout(r, 300));
    expect(viewsA.at(-1)!.view.names).toEqual(['Root', 'Ami']);
    expect(viewsA.at(-1)!.view.you).toBe(0);
    expect(viewsB.at(-1)!.view.you).toBe(1);
    const active = viewsA.at(-1)!.view.state.active;
    const activeRoom = active === 0 ? roomA : roomB;
    activeRoom.send('action', { type: 'endTurn', player: active });
    await new Promise((r) => setTimeout(r, 300));
    expect(viewsA.at(-1)!.view.state.active).toBe(active === 0 ? 1 : 0);
    // a third player cannot join
    await expect(new Client(`ws://localhost:${port}`).joinById(roomA.roomId, {})).rejects.toBeTruthy();
    // a player who leaves for good forfeits
    await roomB.leave(true);
    await new Promise((r) => setTimeout(r, 300));
    expect(viewsA.at(-1)!.view.state.phase).toBe('finished');
    expect(viewsA.at(-1)!.view.state.winner).toBe(0);
    await roomA.leave(true);
  }, 20000);
});
