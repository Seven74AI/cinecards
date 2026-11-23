/**
 * Friends, presence and invitations in this tab (story 8.3): one connection to the server's `hub` room while the
 * player is signed in and the server has friends. The Colyseus SDK is loaded on demand, so a guest's home screen
 * never downloads it.
 */
import { useSyncExternalStore } from 'react';
import type { Room } from '@colyseus/sdk';
import {
  HUB_ROOM_NAME,
  type DeckMode,
  type FriendPresenceMessage,
  type FriendRef,
  type FriendsList,
  type InviteCancelledMessage,
  type InviteDeclinedMessage,
  type InviteFailedMessage,
  type InviteMessage,
  type InviteSentMessage,
} from '@cinecards/protocol';
import { SERVER_URL } from '../net/config.ts';
import { friendsList } from './api.ts';

/** An invitation received, with its deadline on this device's clock. */
export interface ReceivedInvite {
  inviteId: string;
  from: FriendRef;
  roomCode: string;
  mode: DeckMode;
  expiresAt: number;
}

/** The invitation this player sent from the home screen, shown in the waiting room. */
export interface SentInvite {
  to: FriendRef;
  roomCode: string | null;
  inviteId: string | null;
  state: 'sending' | 'sent' | 'declined' | 'expired' | 'failed';
  message?: string;
}

export interface HubSnapshot {
  connected: boolean;
  /** null until the first `GET /api/friends` answers. */
  list: FriendsList | null;
  invites: ReceivedInvite[];
  sent: SentInvite | null;
}

const EMPTY: HubSnapshot = { connected: false, list: null, invites: [], sent: null };
let snap: HubSnapshot = EMPTY;
const listeners = new Set<() => void>();
const set = (patch: Partial<HubSnapshot>) => {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const hubSnapshot = () => snap;
export const useHub = () => useSyncExternalStore(subscribe, hubSnapshot);

let token: string | null = null;
let room: Room | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
/** Bumped on every connect/disconnect so a late answer from an older connection is ignored. */
let generation = 0;
const expiries = new Map<string, ReturnType<typeof setTimeout>>();

/** Reads the friend list again (after a change, or when the panel opens). */
export async function refreshFriends() {
  const t = token;
  if (!t) return;
  const r = await friendsList(t);
  if (t === token && r.ok) set({ list: r.data });
}

const dropInvite = (inviteId: string) => {
  const timer = expiries.get(inviteId);
  if (timer) clearTimeout(timer);
  expiries.delete(inviteId);
  if (snap.invites.some((i) => i.inviteId === inviteId)) set({ invites: snap.invites.filter((i) => i.inviteId !== inviteId) });
};

const addInvite = (m: InviteMessage) => {
  const expiresAt = Date.now() + m.msLeft;
  const inv: ReceivedInvite = { inviteId: m.inviteId, from: m.from, roomCode: m.roomCode, mode: m.mode, expiresAt };
  // a new invitation from the same friend replaces theirs
  const rest = snap.invites.filter((i) => i.inviteId !== m.inviteId && i.from.id !== m.from.id);
  set({ invites: [...rest, inv] });
  expiries.set(
    m.inviteId,
    setTimeout(() => dropInvite(m.inviteId), m.msLeft),
  );
};

const wire = (r: Room) => {
  r.onMessage('friendsChanged', () => void refreshFriends());
  r.onMessage('friendPresence', (m: FriendPresenceMessage) => {
    const list = snap.list;
    if (!list) return;
    set({ list: { ...list, friends: list.friends.map((f) => (f.id === m.id ? { ...f, presence: m.presence } : f)) } });
  });
  r.onMessage('invite', addInvite);
  r.onMessage('inviteCancelled', (m: InviteCancelledMessage) => {
    dropInvite(m.inviteId);
    const s = snap.sent;
    if (s?.inviteId === m.inviteId && s.state === 'sent' && m.reason === 'expired') set({ sent: { ...s, state: 'expired' } });
  });
  r.onMessage('inviteDeclined', (m: InviteDeclinedMessage) => {
    const s = snap.sent;
    if (s?.inviteId === m.inviteId) set({ sent: { ...s, state: 'declined' } });
  });
  r.onMessage('inviteSent', (m: InviteSentMessage) => {
    const s = snap.sent;
    if (s && s.to.id === m.to.id && s.roomCode === m.roomCode) set({ sent: { ...s, inviteId: m.inviteId, state: 'sent' } });
  });
  r.onMessage('inviteFailed', (m: InviteFailedMessage) => {
    const s = snap.sent;
    if (s && s.to.id === m.friendId && s.roomCode === m.roomCode) set({ sent: { ...s, state: 'failed', message: m.message } });
  });
  r.onReconnect(() => {
    set({ connected: true });
    void refreshFriends();
  });
  r.onDrop(() => set({ connected: false }));
};

const scheduleRetry = (gen: number) => {
  if (retry || gen !== generation || !token) return;
  const delay = Math.min(30_000, 2000 * 2 ** attempt++);
  retry = setTimeout(() => {
    retry = null;
    if (gen === generation) void open(gen);
  }, delay);
};

async function open(gen: number) {
  const t = token;
  if (!t || !SERVER_URL) return;
  try {
    const { Client } = await import('@colyseus/sdk');
    const r = await new Client(SERVER_URL).joinOrCreate(HUB_ROOM_NAME, { session: t });
    if (gen !== generation) return void r.leave(true);
    room = r;
    attempt = 0;
    wire(r);
    // the SDK reconnects a dropped connection on its own; if it gives up, start again
    r.onLeave(() => {
      if (room !== r) return;
      room = null;
      set({ connected: false });
      scheduleRetry(gen);
    });
    set({ connected: true });
    void refreshFriends();
  } catch {
    if (gen === generation) scheduleRetry(gen);
  }
}

/** Connects this tab to the hub for an account (no-op if already connected for it). */
export function connectHub(sessionToken: string) {
  if (token === sessionToken) return;
  disconnectHub();
  token = sessionToken;
  const gen = ++generation;
  void refreshFriends();
  void open(gen);
}

/** Signed out (or no friends on this server): closes the connection and forgets everything. */
export function disconnectHub() {
  generation++;
  token = null;
  if (retry) clearTimeout(retry);
  retry = null;
  attempt = 0;
  const r = room;
  room = null;
  if (r) void r.leave(true);
  for (const t of expiries.values()) clearTimeout(t);
  expiries.clear();
  if (snap !== EMPTY) set(EMPTY);
}

/** Starts an invitation for `to` once the waiting room's code is known (`roomCode` null until then). */
export function prepareInvite(to: FriendRef) {
  set({ sent: { to, roomCode: null, inviteId: null, state: 'sending' } });
}

export function sendInvite(roomCode: string) {
  const s = snap.sent;
  if (!s || s.roomCode) return;
  if (!room) return set({ sent: { ...s, roomCode, state: 'failed', message: 'Connexion au serveur impossible. Réessaie plus tard.' } });
  set({ sent: { ...s, roomCode } });
  room.send('invite', { friendId: s.to.id, roomCode });
}

/** Leaving the waiting room: the server cancels the invitation with the room; here we only forget it. */
export function clearSent() {
  if (snap.sent) set({ sent: null });
}

export function declineInvite(inviteId: string) {
  room?.send('declineInvite', { inviteId });
  dropInvite(inviteId);
}

/** "Rejoindre": the invitation is used; the server cancels it when the room starts. */
export function takeInvite(inviteId: string) {
  dropInvite(inviteId);
}
