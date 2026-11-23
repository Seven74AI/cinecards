import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Story 8.3: the hub store, with a fake SDK room. */

type Handler = (m: unknown) => void;
const fake = vi.hoisted(() => ({
  joins: [] as { name: string; options: unknown }[],
  rooms: [] as { handlers: Map<string, Handler>; sent: [string, unknown][]; left: boolean }[],
}));

vi.mock('../net/config.ts', () => ({ SERVER_URL: 'ws://test' }));
vi.mock('./api.ts', () => ({
  friendsList: vi.fn(async () => ({ ok: true, data: { friends: [{ id: 2, nickname: 'Bruno', presence: 'online' }], incoming: [{ id: 3, nickname: 'Chloé' }], outgoing: [] } })),
}));
vi.mock('@colyseus/sdk', () => ({
  Client: class {
    async joinOrCreate(name: string, options: unknown) {
      fake.joins.push({ name, options });
      const room = { handlers: new Map<string, Handler>(), sent: [] as [string, unknown][], left: false };
      fake.rooms.push(room);
      return {
        onMessage: (t: string, h: Handler) => room.handlers.set(t, h),
        onLeave: () => {},
        onDrop: () => {},
        onReconnect: () => {},
        send: (t: string, m: unknown) => room.sent.push([t, m]),
        leave: async () => {
          room.left = true;
        },
      };
    }
  },
}));

const hub = await import('./hub.ts');
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('8.3 hub store', () => {
  afterEach(() => hub.disconnectHub());

  it('connects once per token with the session, loads the list and follows presence', async () => {
    hub.connectHub('tok');
    hub.connectHub('tok');
    await tick();
    await tick();
    expect(fake.joins).toEqual([{ name: 'hub', options: { session: 'tok' } }]);
    const room = fake.rooms.at(-1)!;
    expect(hub.hubSnapshot().connected).toBe(true);
    expect(hub.hubSnapshot().list?.incoming).toEqual([{ id: 3, nickname: 'Chloé' }]);
    room.handlers.get('friendPresence')!({ id: 2, presence: 'inGame' });
    expect(hub.hubSnapshot().list?.friends[0]!.presence).toBe('inGame');
    hub.disconnectHub();
    expect(room.left).toBe(true);
    expect(hub.hubSnapshot()).toEqual({ connected: false, list: null, invites: [], sent: null });
  });

  it('keeps received invitations until declined, cancelled or expired', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      hub.connectHub('tok2');
      await vi.advanceTimersByTimeAsync(0);
      const room = fake.rooms.at(-1)!;
      const invite = (id: string, from: number, msLeft = 120_000) => room.handlers.get('invite')!({ inviteId: id, from: { id: from, nickname: `N${from}` }, roomCode: 'ABCDE', mode: 'shared', expiresAt: 0, msLeft });
      invite('i1', 2);
      invite('i2', 3, 1000);
      expect(hub.hubSnapshot().invites.map((i) => i.inviteId)).toEqual(['i1', 'i2']);
      hub.declineInvite('i1');
      expect(room.sent).toContainEqual(['declineInvite', { inviteId: 'i1' }]);
      await vi.advanceTimersByTimeAsync(1001);
      expect(hub.hubSnapshot().invites).toEqual([]);
      invite('i3', 2);
      invite('i4', 2); // the same friend again replaces theirs
      expect(hub.hubSnapshot().invites.map((i) => i.inviteId)).toEqual(['i4']);
      room.handlers.get('inviteCancelled')!({ inviteId: 'i4', reason: 'started' });
      expect(hub.hubSnapshot().invites).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the invitation once the room code is known and follows its answer', async () => {
    hub.connectHub('tok3');
    await tick();
    const room = fake.rooms.at(-1)!;
    hub.prepareInvite({ id: 2, nickname: 'Bruno' });
    expect(hub.hubSnapshot().sent).toMatchObject({ state: 'sending', roomCode: null });
    hub.sendInvite('ROOM1');
    expect(room.sent).toContainEqual(['invite', { friendId: 2, roomCode: 'ROOM1' }]);
    room.handlers.get('inviteSent')!({ inviteId: 'x', to: { id: 2, nickname: 'Bruno' }, roomCode: 'ROOM1', expiresAt: 0, msLeft: 1 });
    expect(hub.hubSnapshot().sent).toMatchObject({ state: 'sent', inviteId: 'x' });
    room.handlers.get('inviteDeclined')!({ inviteId: 'x', by: { id: 2, nickname: 'Bruno' } });
    expect(hub.hubSnapshot().sent?.state).toBe('declined');
    hub.prepareInvite({ id: 2, nickname: 'Bruno' });
    hub.sendInvite('ROOM2');
    room.handlers.get('inviteFailed')!({ friendId: 2, roomCode: 'ROOM2', error: 'in_game', message: 'Ton ami est en pleine partie.' });
    expect(hub.hubSnapshot().sent).toMatchObject({ state: 'failed', message: 'Ton ami est en pleine partie.' });
    hub.clearSent();
    expect(hub.hubSnapshot().sent).toBeNull();
  });

  it('loads the SDK on demand only', () => {
    const src = readFileSync(new URL('./hub.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^import (?!type)[^;]*'@colyseus\/sdk'/m);
    expect(src).toContain("await import('@colyseus/sdk')");
  });
});
