import type { Client } from '@colyseus/core';
import type { FriendRef, HubServerMessages } from '@cinecards/protocol';
import { Limiter } from '../auth/limiter.ts';
import type { Account } from '../auth/service.ts';
import type { Db } from '../db/db.ts';
import { friendIds } from '../db/friends.ts';
import { PresenceRegistry } from '../presence.ts';
import { FRIEND_LIMITS, FriendService } from './friends.ts';
import { InviteService, type RoomSummary } from './invites.ts';

export interface SocialOptions {
  now?: () => number;
  /** Invitation lifetime; read at each invitation so tests can shorten it. */
  inviteTtlMs?: () => number;
  findRoom: (code: string) => RoomSummary | null;
}

/**
 * Friends, presence and invitations together (story 8.3): the hub connections of each account, the presence they
 * make, and the services that talk to them. One instance per server process, shared by the `hub` rooms and `DuelRoom`.
 */
export class Social {
  readonly presence = new PresenceRegistry();
  readonly friends: FriendService;
  readonly invites: InviteService;
  /** Hub connections by session id (a reconnection keeps its session id but brings a new `Client`). */
  private connections = new Map<string, { client: Client; account: FriendRef }>();
  private stopPresence: () => void;

  constructor(
    private readonly db: Db,
    readonly accountOf: (token: unknown) => Account | null,
    opts: SocialOptions,
  ) {
    const now = opts.now ?? Date.now;
    const limiter = new Limiter(now, FRIEND_LIMITS.actionsPerMinute, 60 * 1000);
    this.friends = new FriendService(db, accountOf, this.presence, limiter, (id, type, msg) => this.send(id, type, msg as never), now, (x, y) => this.invites.unfriended(x, y));
    this.invites = new InviteService({
      presence: this.presence,
      areFriends: (x, y) => this.friends.areFriends(x, y),
      nicknameOf: (id) => this.friends.nicknameOf(id),
      findRoom: opts.findRoom,
      slowDown: (id) => this.friends.slowDown(id),
      send: (id, type, msg) => this.send(id, type, msg),
      now,
      ttlMs: opts.inviteTtlMs,
    });
    // every presence change goes to the account's friends that are connected
    this.stopPresence = this.presence.onChange((id, presence) => {
      for (const friend of friendIds(this.db, id)) this.send(friend, 'friendPresence', { id, presence });
    });
  }

  send<K extends keyof HubServerMessages>(accountId: number, type: K, message: HubServerMessages[K]) {
    for (const c of this.connections.values()) if (c.account.id === accountId) c.client.send(type, message);
  }

  connect(client: Client, account: Account) {
    if (this.connections.has(client.sessionId)) return;
    this.connections.set(client.sessionId, { client, account: { id: account.id, nickname: account.nickname } });
    this.presence.online(account.id);
    for (const inv of this.invites.pendingFor(account.id)) client.send('invite', inv);
  }

  reconnected(client: Client) {
    const c = this.connections.get(client.sessionId);
    if (c) c.client = client;
  }

  disconnect(client: Client) {
    const c = this.connections.get(client.sessionId);
    if (!c) return;
    this.connections.delete(client.sessionId);
    this.presence.offline(c.account.id);
  }

  accountOfConnection(client: Client): FriendRef | null {
    return this.connections.get(client.sessionId)?.account ?? null;
  }

  dispose() {
    this.stopPresence();
    this.invites.dispose();
    this.connections.clear();
  }
}
