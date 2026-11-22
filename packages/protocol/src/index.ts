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
}

export const ROOM_NAME = 'duel';
