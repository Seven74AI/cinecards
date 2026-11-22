import { apply, createGame, RULES, timeoutAction, type Action, type Catalog, type DeckMode, type GameEvent, type GameState, type PlayerId, type RuleError } from '@cinecards/engine';
import type { ViewMessage } from '@cinecards/protocol';
import { redactEvents, redactState } from './redact.ts';

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface DuelOutput {
  view(player: PlayerId, msg: ViewMessage): void;
  rejected(player: PlayerId, error: RuleError): void;
}

/**
 * One online duel, independent from the network layer (stories 6.1, 6.4, 6.5):
 * authoritative engine state, per-seat redacted views, turn timer and reaction timeout.
 */
export class Duel {
  state: GameState;
  seq = 1;
  turnEndsAt: number | null = null;
  reactionEndsAt: number | null = null;
  private turnTimer: unknown = null;
  private reactionTimer: unknown = null;

  constructor(
    private readonly catalog: Catalog,
    opts: { seed: number; mode: DeckMode; firstPlayer?: PlayerId },
    public names: [string, string],
    private readonly out: DuelOutput,
    private readonly clock: Clock = realClock,
    private readonly turnMs = RULES.TURN_SECONDS * 1000,
    private readonly reactionMs = RULES.REACTION_SECONDS * 1000,
  ) {
    const { state, events } = createGame(catalog, { seed: opts.seed, mode: opts.mode });
    this.state = state;
    this.armTimers(true);
    this.broadcast(events);
  }

  get finished() {
    return this.state.phase === 'finished';
  }

  /** Applies an action sent by `seat` (the seat always overrides `action.player`). */
  act(seat: PlayerId, action: Action): boolean {
    const r = apply(this.catalog, this.state, { ...action, player: seat } as Action);
    if (!r.ok) {
      this.out.rejected(seat, r.error);
      return false;
    }
    this.commit(r.state, r.events);
    return true;
  }

  concede(seat: PlayerId) {
    if (!this.finished) this.act(seat, { type: 'concede', player: seat });
  }

  /** Re-sends the current view to one seat (after a reconnection). */
  resend(seat: PlayerId) {
    this.out.view(seat, this.message(seat, []));
  }

  dispose() {
    this.clear();
  }

  private commit(next: GameState, events: GameEvent[]) {
    const turnChanged = events.some((e) => e.type === 'turnStarted');
    this.state = next;
    this.seq++;
    this.armTimers(turnChanged);
    this.broadcast(events);
  }

  private message(seat: PlayerId, events: GameEvent[]): ViewMessage {
    return {
      view: { you: seat, state: redactState(this.state, seat), names: this.names },
      events: redactEvents(events, seat),
      seq: this.seq,
      turnEndsAt: this.turnEndsAt,
      reactionEndsAt: this.reactionEndsAt,
      // remaining time, so clients with a skewed clock still show the right countdown (story 11.3)
      turnMsLeft: this.turnEndsAt === null ? null : Math.max(0, this.turnEndsAt - this.clock.now()),
      reactionMsLeft: this.reactionEndsAt === null ? null : Math.max(0, this.reactionEndsAt - this.clock.now()),
    };
  }

  private broadcast(events: GameEvent[]) {
    this.out.view(0, this.message(0, events));
    this.out.view(1, this.message(1, events));
  }

  private clear() {
    if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
    if (this.reactionTimer) this.clock.clearTimeout(this.reactionTimer);
    this.turnTimer = this.reactionTimer = null;
  }

  private armTimers(newTurn: boolean) {
    if (this.finished) {
      this.clear();
      this.turnEndsAt = this.reactionEndsAt = null;
      return;
    }
    if (newTurn || this.turnEndsAt === null) {
      if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
      this.turnEndsAt = this.clock.now() + this.turnMs;
      this.turnTimer = this.clock.setTimeout(() => this.onTurnTimeout(), this.turnMs);
    }
    if (this.reactionTimer) this.clock.clearTimeout(this.reactionTimer);
    this.reactionTimer = null;
    this.reactionEndsAt = null;
    const p = this.state.pending;
    if (p?.kind === 'reaction') {
      this.reactionEndsAt = this.clock.now() + this.reactionMs;
      this.reactionTimer = this.clock.setTimeout(() => this.act(p.player, { type: 'pass', player: p.player }), this.reactionMs);
    }
  }

  /** Time is up: resolve whatever is pending with its default, then end the turn of the active player. */
  private onTurnTimeout() {
    this.turnTimer = null;
    const turn = this.state.players[this.state.active].turnNumber;
    const active = this.state.active;
    for (let guard = 0; guard < 8; guard++) {
      const a = timeoutAction(this.state);
      if (!a || !this.act(a.player, a)) break;
      if (a.type === 'endTurn' || this.state.active !== active || this.state.players[active].turnNumber !== turn) break;
    }
  }
}
