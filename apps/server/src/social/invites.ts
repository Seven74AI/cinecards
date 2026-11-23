import { randomBytes } from 'node:crypto';
import type { DeckMode } from '@cinecards/engine';
import type { FriendRef, HubServerMessages, InviteCancelReason, InviteMessage } from '@cinecards/protocol';
import type { PresenceRegistry } from '../presence.ts';

/** An invitation lasts 2 min (story 8.3, AC 4). */
export const INVITE_TTL_MS = 2 * 60 * 1000;

export const INVITE_MESSAGES = {
  not_friends: 'Ce joueur n’est pas (ou plus) dans tes amis.',
  offline: 'Ton ami n’est plus en ligne.',
  in_game: 'Ton ami est en pleine partie.',
  room_gone: 'Ta salle n’est plus disponible : crée un nouveau duel.',
} as const;

/** What the invitation service needs to know about a duel room, found by its code. */
export interface RoomSummary {
  /** Account id of seat 0 (the creator), null for a guest. */
  creator: number | null;
  /** True while the room waits for its second player. */
  waiting: boolean;
  mode: DeckMode;
}

export type HubSend = <K extends keyof HubServerMessages>(accountId: number, type: K, message: HubServerMessages[K]) => void;

interface Invite {
  id: string;
  from: FriendRef;
  to: FriendRef;
  roomCode: string;
  mode: DeckMode;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface InviteDeps {
  presence: PresenceRegistry;
  areFriends: (x: number, y: number) => boolean;
  nicknameOf: (id: number) => string | null;
  findRoom: (code: string) => RoomSummary | null;
  /** Counts one action towards the 20-per-minute limit; returns the refusal when over it. */
  slowDown: (accountId: number) => { error: string; message: string } | null;
  send: HubSend;
  now?: () => number;
  ttlMs?: () => number;
}

/**
 * Live invitations to a waiting room (story 8.3). Each lasts 2 min and is cancelled as soon as its room starts or
 * goes; an inviter has at most one invitation out per friend (a new one replaces the old).
 */
export class InviteService {
  private invites = new Map<string, Invite>();
  private readonly now: () => number;

  constructor(private readonly deps: InviteDeps) {
    this.now = deps.now ?? Date.now;
  }

  invite(from: FriendRef, friendId: unknown, roomCode: unknown) {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase().slice(0, 8) : '';
    const fid = typeof friendId === 'number' && Number.isSafeInteger(friendId) ? friendId : -1;
    const refuse = (error: string, message: string) => this.deps.send(from.id, 'inviteFailed', { friendId: fid, roomCode: code, error, message });
    const limited = this.deps.slowDown(from.id);
    if (limited) return refuse(limited.error, limited.message);
    const nickname = fid > 0 ? this.deps.nicknameOf(fid) : null;
    if (!nickname || fid === from.id || !this.deps.areFriends(from.id, fid)) return refuse('not_friends', INVITE_MESSAGES.not_friends);
    const presence = this.deps.presence.of(fid);
    if (presence === 'inGame') return refuse('in_game', INVITE_MESSAGES.in_game);
    if (presence === 'offline') return refuse('offline', INVITE_MESSAGES.offline);
    const room = code ? this.deps.findRoom(code) : null;
    if (!room || !room.waiting || room.creator !== from.id) return refuse('room_gone', INVITE_MESSAGES.room_gone);
    // one invitation out per friend: a new one replaces the previous
    for (const old of this.invites.values()) if (old.from.id === from.id && old.to.id === fid) this.end(old, 'cancelled');
    const ttl = this.deps.ttlMs?.() ?? INVITE_TTL_MS;
    const inv: Invite = {
      id: randomBytes(9).toString('base64url'),
      from: { id: from.id, nickname: from.nickname },
      to: { id: fid, nickname },
      roomCode: code,
      mode: room.mode,
      expiresAt: this.now() + ttl,
      timer: setTimeout(() => this.end(inv, 'expired'), ttl),
    };
    this.invites.set(inv.id, inv);
    this.deps.send(fid, 'invite', this.message(inv));
    this.deps.send(from.id, 'inviteSent', { inviteId: inv.id, to: inv.to, roomCode: code, expiresAt: inv.expiresAt, msLeft: ttl });
  }

  /** The invited player says no: the inviter is told who refused. */
  decline(accountId: number, inviteId: unknown) {
    const inv = typeof inviteId === 'string' ? this.invites.get(inviteId) : undefined;
    if (!inv || inv.to.id !== accountId) return;
    this.drop(inv);
    this.deps.send(inv.to.id, 'inviteCancelled', { inviteId: inv.id, reason: 'cancelled' }); // the invitee's other tabs
    this.deps.send(inv.from.id, 'inviteDeclined', { inviteId: inv.id, by: inv.to });
  }

  /** The inviter takes it back. */
  cancel(accountId: number, inviteId: unknown) {
    const inv = typeof inviteId === 'string' ? this.invites.get(inviteId) : undefined;
    if (inv && inv.from.id === accountId) this.end(inv, 'cancelled');
  }

  /** The invitations still open for an account (sent again when it connects to the hub). */
  pendingFor(accountId: number): InviteMessage[] {
    return [...this.invites.values()].filter((i) => i.to.id === accountId).map((i) => this.message(i));
  }

  roomStarted(code: string) {
    this.endRoom(code, 'started');
  }

  roomGone(code: string) {
    this.endRoom(code, 'gone');
  }

  /** Two accounts stopped being friends: their invitations go. */
  unfriended(x: number, y: number) {
    for (const inv of [...this.invites.values()]) if ((inv.from.id === x && inv.to.id === y) || (inv.from.id === y && inv.to.id === x)) this.end(inv, 'cancelled');
  }

  dispose() {
    for (const inv of this.invites.values()) clearTimeout(inv.timer);
    this.invites.clear();
  }

  get size() {
    return this.invites.size;
  }

  private endRoom(code: string, reason: InviteCancelReason) {
    for (const inv of [...this.invites.values()]) if (inv.roomCode === code) this.end(inv, reason);
  }

  /** Removes an invitation and tells both sides why. */
  private end(inv: Invite, reason: InviteCancelReason) {
    if (!this.drop(inv)) return;
    this.deps.send(inv.to.id, 'inviteCancelled', { inviteId: inv.id, reason });
    this.deps.send(inv.from.id, 'inviteCancelled', { inviteId: inv.id, reason });
  }

  private drop(inv: Invite) {
    clearTimeout(inv.timer);
    return this.invites.delete(inv.id);
  }

  private message(inv: Invite): InviteMessage {
    return { inviteId: inv.id, from: inv.from, roomCode: inv.roomCode, mode: inv.mode, expiresAt: inv.expiresAt, msLeft: Math.max(0, inv.expiresAt - this.now()) };
  }
}
