import { apply, botRandom, botStep, createGame, type Action, type Catalog, type DeckMode, type GameEvent, type GameState, type PlayerId, type RuleError } from '@cinecards/engine';

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
  turnEndsAt: number | null;
  reactionEndsAt: number | null;
  status: 'connecting' | 'waiting' | 'playing' | 'opponentAway' | 'closed';
  roomCode?: string;
  seats?: [string | null, string | null];
  awayUntil?: number | null;
}

export interface Session {
  kind: SessionKind;
  catalog: Catalog;
  get(): Snapshot;
  subscribe(fn: () => void): () => void;
  send(action: Action): void;
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

/** Hot-seat (two players on one device) or a game against the built-in bot. Runs the engine in the browser. */
export function localSession(catalog: Catalog, opts: { kind: 'hotseat' | 'bot'; mode: DeckMode; seed?: number; names?: [string, string] }): Session {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const { state, events } = createGame(catalog, { seed, mode: opts.mode });
  const names: [string, string] = opts.names ?? (opts.kind === 'bot' ? ['Joueur', 'Le Grimoire'] : ['Joueur 1', 'Joueur 2']);
  const viewerOf = (s: GameState): PlayerId => (opts.kind === 'bot' ? 0 : (s.pending?.player ?? s.active));
  const base: Snapshot = { state, events, seq: 1, log: [], error: null, viewer: viewerOf(state), names, turnEndsAt: null, reactionEndsAt: null, status: 'playing' };
  base.log = appendLog(base, events, state, 1);
  const store = new Store(base);
  const rnd = botRandom(seed ^ 0x5bd1e995);
  let botTimer: ReturnType<typeof setTimeout> | null = null;

  const commit = (next: GameState, ev: GameEvent[]) => {
    const seq = store.snap.seq + 1;
    store.set({ state: next, events: ev, seq, log: appendLog(store.snap, ev, next, seq), error: null, viewer: viewerOf(next) });
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
    dispose() {
      if (botTimer) clearTimeout(botTimer);
      botTimer = null;
    },
  };
}
