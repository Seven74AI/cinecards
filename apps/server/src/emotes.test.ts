import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import type { EmoteMessage } from '@cinecards/protocol';
import { startServer } from './main.ts';
import { roomConfig } from './room.ts';

describe('8.5 emotes', () => {
  const port = 26770 + Math.floor(Math.random() * 100);
  const url = () => `ws://localhost:${port}`;
  let server: Awaited<ReturnType<typeof startServer>>;
  let t = 100_000;
  beforeAll(async () => {
    roomConfig.now = () => t;
    server = await startServer(port, undefined, { dataDir: ':memory:' });
  });
  afterAll(async () => {
    roomConfig.now = undefined;
    await server.gracefullyShutdown(false);
  });

  const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
  const listen = (room: Room) => {
    const got: EmoteMessage[] = [];
    room.onMessage('emote', (m: EmoteMessage) => got.push(m));
    room.onMessage('lobby', () => {});
    room.onMessage('view', () => {});
    return got;
  };

  it('refuses emotes before the duel starts, then relays known ids to both seats, at most one per 3 s', async () => {
    const roomA = await new Client(url()).create('duel', { mode: 'shared', nickname: 'Hôte' });
    const gotA = listen(roomA);
    roomA.send('emote', { id: 'gg' });
    await wait();
    expect(gotA).toEqual([]);

    const roomB = await new Client(url()).joinById(roomA.roomId, { nickname: 'Invité' });
    const gotB = listen(roomB);
    await wait();
    roomA.send('emote', { id: 'gg' });
    await wait();
    expect(gotA).toEqual([{ from: 0, id: 'gg' }]);
    expect(gotB).toEqual([{ from: 0, id: 'gg' }]);

    // too soon for seat 0, but seat 1 has its own limit
    t += 2999;
    roomA.send('emote', { id: 'oops' });
    roomB.send('emote', { id: 'thanks' });
    await wait();
    expect(gotB).toEqual([
      { from: 0, id: 'gg' },
      { from: 1, id: 'thanks' },
    ]);

    // unknown ids and junk are ignored and do not use up the 3 s
    t += 1;
    roomA.send('emote', { id: 'toString' });
    roomA.send('emote', { id: 'free text' });
    roomA.send('emote', null);
    await wait();
    roomA.send('emote', { id: 'rematch' });
    await wait();
    expect(gotA.map((m) => m.id)).toEqual(['gg', 'thanks', 'rematch']);
    expect(gotB.at(-1)).toEqual({ from: 0, id: 'rematch' });

    // still allowed on the end screen
    roomA.send('action', { type: 'concede', player: 0 });
    await wait();
    t += 3000;
    roomB.send('emote', { id: 'goodgame' });
    await wait();
    expect(gotA.at(-1)).toEqual({ from: 1, id: 'goodgame' });
    await roomA.leave(true);
    await roomB.leave(true);
  }, 20000);
});
