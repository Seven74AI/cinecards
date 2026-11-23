import type { FriendsList } from '@cinecards/protocol';
import type { Account, AuthError, AuthResult } from '../auth/service.ts';
import { nicknameKey } from '../auth/nickname.ts';
import { findAccountById, findAccountByKey } from '../db/accounts.ts';
import type { Db } from '../db/db.ts';
import { acceptFriendship, countFriends, countOutgoing, deleteFriendship, findFriendship, insertRequest, listFriendships } from '../db/friends.ts';
import type { Limiter } from '../auth/limiter.ts';
import type { PresenceRegistry } from '../presence.ts';

/** Limits per account (story 8.3, AC 7). */
export const FRIEND_LIMITS = { friends: 100, outgoing: 50, actionsPerMinute: 20 } as const;

/** Player-facing messages (French, tutoiement). */
export const FRIEND_MESSAGES = {
  unauthorized: 'Ta session a expiré. Reconnecte-toi.',
  unknown_player: 'Aucun joueur ne porte ce pseudo.',
  self: 'C’est ton propre pseudo.',
  already_friends: 'Vous êtes déjà amis.',
  already_requested: 'Tu lui as déjà envoyé une demande.',
  slow_down: 'Doucement ! Réessaie dans un instant.',
  limit_friends: `Tu as déjà ${FRIEND_LIMITS.friends} amis : retires-en un d’abord.`,
  limit_their_friends: `Ce joueur a déjà ${FRIEND_LIMITS.friends} amis.`,
  limit_outgoing: `Tu as déjà ${FRIEND_LIMITS.outgoing} demandes en attente.`,
  not_found: 'Cette demande n’existe plus.',
} as const;

const fail = (status: number, error: string, message: string): AuthError => ({ ok: false, status, error, message });

/** Sends a hub message to every connection of an account (no-op when it has none). */
export type Notify = (accountId: number, type: 'friendsChanged' | 'friendPresence', message: object) => void;

/**
 * Friend requests and the friend list (story 8.3). Every change tells both accounts through the hub
 * (`friendsChanged`), so their lists refresh within a moment.
 */
export class FriendService {
  constructor(
    private readonly db: Db,
    private readonly accountOf: (token: unknown) => Account | null,
    private readonly presence: PresenceRegistry,
    private readonly limiter: Limiter,
    private readonly notify: Notify,
    private readonly now: () => number = Date.now,
    /** Called when two accounts stop being friends (their pending invitations are cancelled). */
    private readonly unfriended: (x: number, y: number) => void = () => {},
  ) {}

  /** Counts one request or invitation; returns the 429 when the account already made 20 this minute. */
  slowDown(accountId: number): AuthError | null {
    const key = `social:${accountId}`;
    if (this.limiter.retryAfterMs(key) > 0) return fail(429, 'slow_down', FRIEND_MESSAGES.slow_down);
    this.limiter.fail(key);
    return null;
  }

  list(token: unknown): AuthResult<FriendsList> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized', FRIEND_MESSAGES.unauthorized);
    const out: FriendsList = { friends: [], incoming: [], outgoing: [] };
    for (const l of listFriendships(this.db, me.id)) {
      const ref = { id: l.id, nickname: l.nickname };
      if (l.status === 'accepted') out.friends.push({ ...ref, presence: this.presence.of(l.id) });
      else if (l.requestedBy === me.id) out.outgoing.push(ref);
      else out.incoming.push(ref);
    }
    return { ok: true, ...out };
  }

  /** Sends a request by exact nickname; accepts at once when the other player had already asked. */
  request(token: unknown, nickname: unknown): AuthResult<{ status: 'pending' | 'accepted' }> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized', FRIEND_MESSAGES.unauthorized);
    // every attempt counts, so nicknames cannot be probed quickly
    const limited = this.slowDown(me.id);
    if (limited) return limited;
    const key = typeof nickname === 'string' ? nicknameKey(nickname.slice(0, 64)) : '';
    const other = key ? findAccountByKey(this.db, key) : undefined;
    if (!other) return fail(404, 'unknown_player', FRIEND_MESSAGES.unknown_player);
    if (other.id === me.id) return fail(400, 'self', FRIEND_MESSAGES.self);
    const row = findFriendship(this.db, me.id, other.id);
    if (row?.status === 'accepted') return fail(409, 'already_friends', FRIEND_MESSAGES.already_friends);
    if (row && row.requested_by === me.id) return fail(409, 'already_requested', FRIEND_MESSAGES.already_requested);
    if (row) {
      // the other player had already asked: adding them back accepts
      const full = this.friendLimit(me.id, other.id);
      if (full) return full;
      acceptFriendship(this.db, me.id, other.id, this.now());
      this.changed(me.id, other.id);
      return { ok: true, status: 'accepted' };
    }
    const full = this.friendLimit(me.id, other.id);
    if (full) return full;
    if (countOutgoing(this.db, me.id) >= FRIEND_LIMITS.outgoing) return fail(409, 'limit_reached', FRIEND_MESSAGES.limit_outgoing);
    insertRequest(this.db, me.id, other.id, this.now());
    this.changed(me.id, other.id);
    return { ok: true, status: 'pending' };
  }

  /** Accepts a request received from `otherId`. */
  accept(token: unknown, otherId: number): AuthResult<object> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized', FRIEND_MESSAGES.unauthorized);
    const row = Number.isSafeInteger(otherId) ? findFriendship(this.db, me.id, otherId) : undefined;
    if (!row || row.status !== 'pending' || row.requested_by === me.id) return fail(404, 'not_found', FRIEND_MESSAGES.not_found);
    const full = this.friendLimit(me.id, otherId);
    if (full) return full;
    acceptFriendship(this.db, me.id, otherId, this.now());
    this.changed(me.id, otherId);
    return { ok: true };
  }

  /** Declines a received request, cancels a sent one or removes a friend: the row goes, on both sides. Idempotent. */
  remove(token: unknown, otherId: number): AuthResult<object> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized', FRIEND_MESSAGES.unauthorized);
    if (Number.isSafeInteger(otherId) && deleteFriendship(this.db, me.id, otherId)) {
      this.unfriended(me.id, otherId);
      this.changed(me.id, otherId);
    }
    return { ok: true };
  }

  /** True when the two accounts are accepted friends. */
  areFriends(x: number, y: number) {
    return findFriendship(this.db, x, y)?.status === 'accepted';
  }

  nicknameOf(id: number) {
    return findAccountById(this.db, id)?.nickname ?? null;
  }

  private friendLimit(me: number, other: number): AuthError | null {
    if (countFriends(this.db, me) >= FRIEND_LIMITS.friends) return fail(409, 'limit_reached', FRIEND_MESSAGES.limit_friends);
    if (countFriends(this.db, other) >= FRIEND_LIMITS.friends) return fail(409, 'limit_reached', FRIEND_MESSAGES.limit_their_friends);
    return null;
  }

  private changed(...ids: number[]) {
    for (const id of ids) this.notify(id, 'friendsChanged', {});
  }
}
