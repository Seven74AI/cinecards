import { Room, ServerError, type Client } from '@colyseus/core';
import type { HubOptions } from '@cinecards/protocol';
import type { Account } from './auth/service.ts';
import type { Social } from './social/social.ts';

/** Injected at startup (main.ts), like `roomConfig`. */
export const hubConfig: { social: Social | null; reconnectSeconds?: number } = { social: null };

/**
 * The `hub` room (story 8.3): one shared room every signed-in tab joins, for live presence, friend-list changes and
 * invitations. Its state lives in `Social`, so a second instance (a join race) would behave the same.
 */
export class HubRoom extends Room {
  maxClients = 100_000;
  autoDispose = false;

  onCreate() {
    const social = () => hubConfig.social;
    this.onMessage('invite', (client: Client, m: { friendId?: unknown; roomCode?: unknown } | null) => {
      const me = social()?.accountOfConnection(client);
      if (me && m && typeof m === 'object') social()!.invites.invite(me, m.friendId, m.roomCode);
    });
    this.onMessage('declineInvite', (client: Client, m: { inviteId?: unknown } | null) => {
      const me = social()?.accountOfConnection(client);
      if (me && m && typeof m === 'object') social()!.invites.decline(me.id, m.inviteId);
    });
    this.onMessage('cancelInvite', (client: Client, m: { inviteId?: unknown } | null) => {
      const me = social()?.accountOfConnection(client);
      if (me && m && typeof m === 'object') social()!.invites.cancel(me.id, m.inviteId);
    });
  }

  /** A valid account session is required; a guest or an expired session is refused. */
  onAuth(_client: Client, options: Partial<HubOptions>) {
    const account = hubConfig.social?.accountOf(options?.session) ?? null;
    if (!account) throw new ServerError(4401, 'unauthorized');
    return account;
  }

  onJoin(client: Client, _options: HubOptions, account: Account) {
    hubConfig.social?.connect(client, account);
  }

  /** A dropped connection stays "online" for a few seconds while the SDK reconnects. */
  onDrop(client: Client) {
    this.allowReconnection(client, hubConfig.reconnectSeconds ?? 20).catch(() => {});
  }

  onReconnect(client: Client) {
    hubConfig.social?.reconnected(client);
  }

  onLeave(client: Client) {
    hubConfig.social?.disconnect(client);
  }
}
