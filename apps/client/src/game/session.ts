import { apply, botRandom, botStep, createGame, RULES, timeoutAction, type Action, type Catalog, type DeckMode, type GameEvent, type GameState, type PlayerId, type RuleError } from '@cinecards/engine';

export type SessionKind = 'hotseat' | 'bot' | 'online';

export interface Snapshot {
  state: GameState;
  /** Events of the latest batch (for animations and the journal). */
  events: GameEvent[];
  seq: number;
  /** Every journal-worthy event since the start, in order. */
  log: { seq: number; event: GameEvent; state: GameState }[];
  error: { error: RuleError; at: number } | null;
  /** Player shown at the bottom of the table. */
  viewer: PlayerId;
  names: [string, string];
  /** Local epoch ms when the turn timer runs out, while it runs. */
  turnEndsAt: number | null;
  /** Milliseconds left while the turn timer is paused (hot-seat hand-over, reaction window). */
  turnMsLeft?: number | null;
  reactionEndsAt: number | null;
  status: 'connecting' | 'waiting' | 'playing' | 'opponentAway' | 'closed';
  roomCode?: string;
  seats?: [string | null, string | null];
  awayUntil?: number | null;
  /** Online: the connection dropped and the SDK is retrying. */
  reconnecting?: boolean;
}

export interface Session {
  kind: SessionKind;
  catalog: Catalog;
  get(): Snapshot;
  subscribe(fn: () => void): () => void;
  send(action: Action): void;
  /** Hot seat: the next player dismissed the pass-the-device screen; their clock starts now. */
  ready?(): void;
  dispose(): void;
}

export class Store {
  private listeners = new Set<() => void>();
  constructor(public snap: Snapshot) {}
  get = () => this.snap;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }
}

const MAX_LOG = 400;
export function appendLog(snap: Snapshot, events: GameEvent[], state: GameState, seq: number): Snapshot['log'] {
  const log = [...snap.log, ...events.map((event) => ({ seq, event, state }))];
  return log.length > MAX_LOG ? log.slice(-MAX_LOG) : log;
}

/**
 * Turn and reaction timers for sessions that run the engine in the browser (story 11.3), mirroring the
 * server: 75 s per turn, 5 s per reaction window. The turn clock pauses during a reaction window and,
 * in hot seat, until the pass-the-device screen is dismissed. When time runs out, `onTimeout` is called.
 */
export class LocalClock {
  private msLeft: number;
  private runningSince: number | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private reactionTimer: ReturnType<typeof setTimeout> | null = null;
  private reactionKey: string | null = null;
  reactionEndsAt: number | null = null;
  /** Waiting for the hot-seat hand-over screen to be dismissed. */
  handoff = false;

  constructor(
    private readonly onTurnTimeout: () => void,
    private readonly onReactionTimeout: () => void,
    private readonly turnMs = RULES.TURN_SECONDS * 1000,
    private readonly reactionMs = RULES.REACTION_SECONDS * 1000,
  ) {
    this.msLeft = turnMs;
  }

  /** Brings the timers in line with the state; `newTurn` restarts the turn clock at 75 s. */
  sync(state: GameState, newTurn: boolean) {
    if (newTurn) {
      this.pauseTurn();
      this.msLeft = this.turnMs;
    }
    if (state.phase === 'finished') {
      this.pauseTurn();
      this.clearReaction();
      return;
    }
    const reaction = state.pending?.kind === 'reaction' ? state.pending.key + ':' + state.pending.player : null;
    if (reaction !== this.reactionKey) this.clearReaction();
    if (this.handoff) {
      this.pauseTurn();
      return;
    }
    if (reaction) {
      this.pauseTurn();
      if (!this.reactionTimer) {
        this.reactionKey = reaction;
        this.reactionEndsAt = Date.now() + this.reactionMs;
        this.reactionTimer = setTimeout(() => {
          this.reactionTimer = null;
          this.onReactionTimeout();
        }, this.reactionMs);
      }
      return;
    }
    if (this.runningSince === null) {
      this.runningSince = Date.now();
      this.turnTimer = setTimeout(() => {
        this.turnTimer = null;
        this.runningSince = null;
        this.msLeft = 0;
        this.onTurnTimeout();
      }, this.msLeft);
    }
  }

  get turnEndsAt() {
    return this.runningSince === null ? null : this.runningSince + this.msLeft;
  }
  get turnMsLeft() {
    return this.runningSince === null ? this.msLeft : null;
  }

  dispose() {
    this.pauseTurn();
    this.clearReaction();
  }

  private pauseTurn() {
    if (this.runningSince !== null) this.msLeft = Math.max(0, this.msLeft - (Date.now() - this.runningSince));
    this.runningSince = null;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  private clearReaction() {
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.reactionTimer = null;
    this.reactionKey = null;
    this.reactionEndsAt = null;
  }
}

/** Hot-seat (two players on one device) or a game against the built-in bot. Runs the engine in the browser. */
export function localSession(
  catalog: Catalog,
  opts: { kind: 'hotseat' | 'bot'; mode: DeckMode; seed?: number; names?: [string, string]; turnMs?: number; reactionMs?: number },
): Session {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const { state, events } = createGame(catalog, { seed, mode: opts.mode });
  const names: [string, string] = opts.names ?? (opts.kind === 'bot' ? ['Joueur', 'Le Grimoire'] : ['Joueur 1', 'Joueur 2']);
  const viewerOf = (s: GameState): PlayerId => (opts.kind === 'bot' ? 0 : (s.pending?.player ?? s.active));
  const base: Snapshot = { state, events, seq: 1, log: [], error: null, viewer: viewerOf(state), names, turnEndsAt: null, reactionEndsAt: null, status: 'playing' };
  base.log = appendLog(base, events, state, 1);
  const store = new Store(base);
  const rnd = botRandom(seed ^ 0x5bd1e995);
  let botTimer: ReturnType<typeof setTimeout> | null = null;

  const publishClock = () => store.set({ turnEndsAt: clock.turnEndsAt, turnMsLeft: clock.turnMsLeft, reactionEndsAt: clock.reactionEndsAt });

  /** Time is up: default every pending choice, then end the turn, as one batch (story 11.3). */
  const onTurnTimeout = () => {
    let cur = store.snap.state;
    const all: GameEvent[] = [];
    const turn = cur.players[cur.active].turnNumber;
    const active = cur.active;
    for (let guard = 0; guard < 8; guard++) {
      const a = timeoutAction(cur);
      if (!a) break;
      const r = apply(catalog, cur, a);
      if (!r.ok) break;
      cur = r.state;
      all.push(...r.events);
      if (a.type === 'endTurn' || cur.active !== active || cur.players[active].turnNumber !== turn) break;
    }
    if (all.length) commit(cur, all);
  };
  const onReactionTimeout = () => {
    const p = store.snap.state.pending;
    if (p?.kind !== 'reaction') return;
    const r = apply(catalog, store.snap.state, { type: 'pass', player: p.player });
    if (r.ok) commit(r.state, r.events);
  };
  const clock = new LocalClock(onTurnTimeout, onReactionTimeout, opts.turnMs, opts.reactionMs);
  // hot seat: the first player's clock starts once the pass-the-device screen is dismissed
  clock.handoff = opts.kind === 'hotseat';
  clock.sync(state, true);
  publishClock();

  const commit = (next: GameState, ev: GameEvent[]) => {
    const seq = store.snap.seq + 1;
    const viewer = viewerOf(next);
    if (opts.kind === 'hotseat' && viewer !== store.snap.viewer && next.phase !== 'finished') clock.handoff = true;
    clock.sync(next, ev.some((e) => e.type === 'turnStarted'));
    store.set({ state: next, events: ev, seq, log: appendLog(store.snap, ev, next, seq), error: null, viewer });
    publishClock();
    scheduleBot();
  };

  const scheduleBot = () => {
    if (opts.kind !== 'bot' || botTimer) return;
    const s = store.snap.state;
    const actor = s.pending ? s.pending.player : s.active;
    if (s.phase === 'finished' || actor !== 1) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      const cur = store.snap.state;
      const who = cur.pending ? cur.pending.player : cur.active;
      if (cur.phase === 'finished' || who !== 1) return;
      const step = botStep(catalog, cur, 1, rnd);
      if (step) {
        const r = apply(catalog, cur, step.action);
        if (r.ok) commit(r.state, r.events);
      }
    }, 900);
  };

  // The coin toss may hand the first turn to the bot: start it right away (story 11.1).
  scheduleBot();

  return {
    kind: opts.kind,
    catalog,
    get: store.get,
    subscribe: store.subscribe,
    send(action) {
      const r = apply(catalog, store.snap.state, action);
      if (!r.ok) store.set({ error: { error: r.error, at: Date.now() } });
      else commit(r.state, r.events);
    },
    ready() {
      if (!clock.handoff) return;
      clock.handoff = false;
      clock.sync(store.snap.state, false);
      publishClock();
    },
    dispose() {
      if (botTimer) clearTimeout(botTimer);
      botTimer = null;
      clock.dispose();
    },
  };
}
