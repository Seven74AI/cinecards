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
  /** Story 8.4: called once, after the views, when the game reaches `finished`. */
  ended?(duel: Duel): void;
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
  /** Turn time left while the turn timer is paused by a reaction window (GDD Turn Structure, architecture P3). */
  turnPausedMs: number | null = null;
  /** When the duel started (story 8.4, history). */
  readonly startedAt: number;
  /** The seat whose `conceded` event ended the game, if any (story 8.4). */
  concededBy: PlayerId | null = null;
  private turnTimer: unknown = null;
  private reactionTimer: unknown = null;

  constructor(
    private readonly catalog: Catalog,
    opts: { seed: number; mode: DeckMode; firstPlayer?: PlayerId; decks?: [string[], string[]] },
    public names: [string, string],
    private readonly out: DuelOutput,
    private readonly clock: Clock = realClock,
    private readonly turnMs = RULES.TURN_SECONDS * 1000,
    private readonly reactionMs = RULES.REACTION_SECONDS * 1000,
  ) {
    this.startedAt = clock.now();
    const { state, events } = createGame(catalog, { seed: opts.seed, mode: opts.mode, ...(opts.decks ? { decks: opts.decks } : {}) });
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

  /** Both players' own turn counters added up (story 8.4). */
  get turns() {
    return this.state.players[0].turnNumber + this.state.players[1].turnNumber;
  }

  private commit(next: GameState, events: GameEvent[]) {
    const wasFinished = this.finished;
    const turnChanged = events.some((e) => e.type === 'turnStarted');
    const conceded = events.find((e): e is Extract<GameEvent, { type: 'conceded' }> => e.type === 'conceded');
    if (conceded && !wasFinished) this.concededBy = conceded.player;
    this.state = next;
    this.seq++;
    this.armTimers(turnChanged);
    this.broadcast(events);
    if (!wasFinished && this.finished) this.out.ended?.(this);
  }

  private message(seat: PlayerId, events: GameEvent[]): ViewMessage {
    const paused = this.turnPausedMs !== null;
    return {
      view: { you: seat, state: redactState(this.state, seat), names: this.names },
      events: redactEvents(events, seat),
      seq: this.seq,
      // older clients only read the absolute time: give them a deadline as if the timer were running
      turnEndsAt: paused ? this.clock.now() + this.turnPausedMs! : this.turnEndsAt,
      reactionEndsAt: this.reactionEndsAt,
      // remaining time, so clients with a skewed clock still show the right countdown (story 11.3)
      turnMsLeft: paused ? this.turnPausedMs : this.turnEndsAt === null ? null : Math.max(0, this.turnEndsAt - this.clock.now()),
      ...(paused ? { turnPaused: true } : {}),
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
      this.turnEndsAt = this.reactionEndsAt = this.turnPausedMs = null;
      return;
    }
    if (newTurn || (this.turnEndsAt === null && this.turnPausedMs === null)) this.startTurnTimer(this.turnMs);
    if (this.reactionTimer) this.clock.clearTimeout(this.reactionTimer);
    this.reactionTimer = null;
    this.reactionEndsAt = null;
    const p = this.state.pending;
    if (p?.kind === 'reaction') {
      // the turn timer stops while the defender decides (GDD Turn Structure, architecture P3)
      if (this.turnPausedMs === null && this.turnEndsAt !== null) {
        this.turnPausedMs = Math.max(0, this.turnEndsAt - this.clock.now());
        if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
        this.turnTimer = null;
        this.turnEndsAt = null;
      }
      this.reactionEndsAt = this.clock.now() + this.reactionMs;
      this.reactionTimer = this.clock.setTimeout(() => this.act(p.player, { type: 'pass', player: p.player }), this.reactionMs);
    } else if (this.turnPausedMs !== null) {
      this.startTurnTimer(this.turnPausedMs);
    }
  }

  private startTurnTimer(ms: number) {
    if (this.turnTimer) this.clock.clearTimeout(this.turnTimer);
    this.turnPausedMs = null;
    this.turnEndsAt = this.clock.now() + ms;
    this.turnTimer = this.clock.setTimeout(() => this.onTurnTimeout(), ms);
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
