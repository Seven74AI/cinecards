/**
 * Shared contract between client and server (architecture: API Contracts).
 * Game types come from the engine; this package adds the network messages.
 */
export type { Action, ErrorCode, GameEvent, GameState, PlayerId, RuleError, Target, DeckMode } from '@cinecards/engine';
import type { Action, DeckMode, GameEvent, GameState, PlayerId, RuleError } from '@cinecards/engine';

/** Marker for a card the receiver is not allowed to see. */
export const HIDDEN = '?';

/** What one player is allowed to see (story 6.3): hidden cards are replaced by `?n` ids without instances. */
export interface PlayerView {
  you: PlayerId;
  state: GameState;
  names: [string, string];
}

export interface ViewMessage {
  view: PlayerView;
  events: GameEvent[];
  seq: number;
  /** Server epoch ms. Kept one release for older clients; prefer the `*MsLeft` fields (story 11.3). */
  turnEndsAt: number | null;
  reactionEndsAt: number | null;
  /** Milliseconds left on the turn timer when the message was sent (absent from older servers). */
  turnMsLeft?: number | null;
  reactionMsLeft?: number | null;
  /** True while the turn timer is paused by a reaction window; `turnMsLeft` is then frozen (story 11.3 follow-up). */
  turnPaused?: boolean;
}

export interface LobbyMessage {
  code: string;
  seats: [string | null, string | null];
  you: PlayerId;
  mode: DeckMode;
}

export interface AwayMessage {
  player: PlayerId;
  /** Epoch ms when the absent player forfeits, or null when they are back. */
  until: number | null;
}

export interface ClientMessages {
  action: Action;
}

export interface ServerMessages {
  lobby: LobbyMessage;
  view: ViewMessage;
  rejected: RuleError;
  away: AwayMessage;
}

export interface RoomOptions {
  mode?: DeckMode;
  nickname?: string;
  /** Account session token (story 8.1); the server then uses the account's nickname. Absent = guest. */
  session?: string;
}

export const ROOM_NAME = 'duel';

// ---- story 8.3: friends, presence and direct invitations (room `hub`) ----

export const HUB_ROOM_NAME = 'hub';

/** Green = the game is open and signed in, orange = playing an online duel, grey = not connected. */
export type Presence = 'online' | 'inGame' | 'offline';

export interface FriendRef {
  id: number;
  nickname: string;
}

/** `GET /api/friends`. */
export interface FriendsList {
  friends: (FriendRef & { presence: Presence })[];
  incoming: FriendRef[];
  outgoing: FriendRef[];
}

/** Joining the hub needs a valid account session. */
export interface HubOptions {
  session: string;
}

export interface FriendPresenceMessage {
  id: number;
  presence: Presence;
}

export interface InviteMessage {
  inviteId: string;
  from: FriendRef;
  roomCode: string;
  mode: DeckMode;
  /** Server epoch ms; prefer `msLeft` (a skewed device clock). */
  expiresAt: number;
  msLeft: number;
}

export type InviteCancelReason = 'expired' | 'started' | 'gone' | 'cancelled';

export interface InviteCancelledMessage {
  inviteId: string;
  reason: InviteCancelReason;
}

export interface InviteDeclinedMessage {
  inviteId: string;
  by: FriendRef;
}

/** To the inviter: the invitation is out (its id is needed to match a decline or to cancel it). */
export interface InviteSentMessage {
  inviteId: string;
  to: FriendRef;
  roomCode: string;
  expiresAt: number;
  msLeft: number;
}

/** To the inviter: the invitation was refused by the server (not friends, offline, in a game, room gone, too many). */
export interface InviteFailedMessage {
  friendId: number;
  roomCode: string;
  error: string;
  message: string;
}

export interface HubServerMessages {
  friendPresence: FriendPresenceMessage;
  /** Something changed in the friend list: the client reads `GET /api/friends` again. */
  friendsChanged: Record<string, never>;
  invite: InviteMessage;
  inviteCancelled: InviteCancelledMessage;
  inviteDeclined: InviteDeclinedMessage;
  inviteSent: InviteSentMessage;
  inviteFailed: InviteFailedMessage;
}

export interface HubClientMessages {
  invite: { friendId: number; roomCode: string };
  declineInvite: { inviteId: string };
  cancelInvite: { inviteId: string };
}
