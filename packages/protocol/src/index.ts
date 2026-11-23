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
  /** Story 10.3, constructed rooms only: you still have to choose your deck (`chooseDeck`) before the duel starts. */
  needDeck?: boolean;
  /** Story 10.3, constructed rooms only: which seats have a checked deck. */
  deckChosen?: [boolean, boolean];
  /** Story 10.3, constructed rooms only: the id of the deck the server holds for you, or null. */
  deckId?: number | null;
}

/** Story 10.3: the server refused the deck sent with `chooseDeck` (or it became invalid before the start). */
export interface DeckRefusedMessage {
  message: string;
}

/** Story 10.3: close code of a join refused because of the constructed mode; the error message is French. */
export const DECK_REFUSED_CODE = 4210;

export interface AwayMessage {
  player: PlayerId;
  /** Epoch ms when the absent player forfeits, or null when they are back. */
  until: number | null;
}

// ---- story 8.5: emotes (fixed written lines, no free chat) ----

/** The 8 emotes by stable id; the client shows the text, the server only relays known ids. */
export const EMOTES = {
  gg: 'Bien joué !',
  oops: 'Oups…',
  thanks: 'Merci !',
  thinking: 'Je réfléchis…',
  regret: 'Tu vas le regretter.',
  nice: 'Pas mal !',
  goodgame: 'Bonne partie !',
  rematch: 'Revanche ?',
} as const;

export type EmoteId = keyof typeof EMOTES;

export const EMOTE_IDS = Object.keys(EMOTES) as EmoteId[];

/** At most one emote per seat this often (ms). */
export const EMOTE_COOLDOWN_MS = 3000;

export const isEmoteId = (id: unknown): id is EmoteId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(EMOTES, id);

export interface EmoteMessage {
  from: PlayerId;
  id: EmoteId;
}

export interface ClientMessages {
  action: Action;
  emote: { id: EmoteId };
  /** Story 10.3: the deck this seat plays in a constructed room (only its id: the server reads and checks it). */
  chooseDeck: { deckId: number };
}

export interface ServerMessages {
  lobby: LobbyMessage;
  view: ViewMessage;
  rejected: RuleError;
  away: AwayMessage;
  emote: EmoteMessage;
  deckRefused: DeckRefusedMessage;
}

export interface RoomOptions {
  mode?: DeckMode;
  nickname?: string;
  /** Account session token (story 8.1); the server then uses the account's nickname. Absent = guest. */
  session?: string;
  /** Story 10.3: one of the account's saved decks, for a `constructed` room (the server loads and checks it). */
  deckId?: number;
  /**
   * Story 10.3: this client can choose its deck in the waiting room. A constructed room refuses a join without it
   * (and without `deckId`), which is how an older client gets a clean refusal instead of a seat it cannot use.
   */
  pickDeck?: boolean;
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
