import type { Catalog, GameEvent, GameState } from '@cinecards/engine';
import { planBeats, type Beat } from './fx.ts';
import { drawnBy, idleView, shownView, type ShownView } from './present.ts';

/** "Vitesse des animations" (story 12.1). */
export type AnimSpeed = 'normal' | 'fast' | 'instant';
export const SPEEDS: AnimSpeed[] = ['normal', 'fast', 'instant'];
export const SPEED_FR: Record<AnimSpeed, string> = { normal: 'normale', fast: 'rapide', instant: 'instantanée' };
const FACTOR: Record<AnimSpeed, number> = { normal: 1, fast: 0.5, instant: 0 };
/** Remaining playback runs this much faster once the player acts, or when batches wait in line. */
export const HURRY = 0.25;
const BACKLOG = 0.5;
const KEY = 'cinecards.animSpeed';

export function loadSpeed(): AnimSpeed {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'fast' || v === 'instant' ? v : 'normal';
  } catch {
    return 'normal';
  }
}
export function saveSpeed(s: AnimSpeed) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* private mode: keep it for this session only */
  }
}

interface Batch {
  id: number;
  before: GameState;
  after: GameState;
  events: GameEvent[];
  beats: Beat[];
}

/** A beat starting now; `ms` is its real duration at the current pace (0 when instant). */
export type Cue = { beat: Beat; ms: number; rate: number; before: GameState; after: GameState; events: GameEvent[] };

declare global {
  interface Window {
    /** Dev builds only: order of the beats played, read by the e2e tests. */
    __ccBeats?: { type: string; iid?: string; phase: 'start' | 'end'; t: number }[];
  }
}
const trace = (type: string, phase: 'start' | 'end', iid?: string) => {
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window.__ccBeats ??= []).push({ type, iid, phase, t: performance.now() });
};

/**
 * Replays event batches one beat at a time (story 12.1). Batches queue up and play in order; the shown
 * view (see `shownView`) moves forward at each beat. Nothing here decides a rule: the last batch's
 * `after` state is always where the view ends.
 */
export class Playback {
  private queue: Batch[] = [];
  /** `held`: cards kept in their slot while they die or go back to hand. */
  private cur: { batch: Batch; played: number; held: Set<string> } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deathTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private view: ShownView;
  private listeners = new Set<() => void>();
  private paused = false;
  /** Batches up to this id play hurried (the ones queued before the player acted). */
  private hurryThrough = 0;
  private lastId = 0;
  /** Real-time end of the current beat chain (for `busyFor`). */
  private endsAt = 0;
  speed: AnimSpeed;
  onCue: (c: Cue) => void = () => {};

  constructor(
    private readonly catalog: Catalog,
    state: GameState,
    speed: AnimSpeed = 'normal',
  ) {
    this.view = idleView(state);
    this.speed = speed;
  }

  get = () => this.view;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get playing() {
    return !!this.cur || this.queue.length > 0;
  }

  /** Current pace: 0 = instant, 1 = normal. */
  rate(): number {
    let r = FACTOR[this.speed];
    if (this.cur && this.cur.batch.id <= this.hurryThrough) r *= HURRY;
    else if (this.queue.length > 0) r *= BACKLOG;
    return r;
  }

  push(before: GameState, after: GameState, events: GameEvent[]) {
    const beats = planBeats(events, this.catalog);
    if (!beats.length && !this.playing) {
      this.view = idleView(after);
      this.emit();
      return;
    }
    this.queue.push({ id: ++this.lastId, before, after, events, beats });
    if (!this.cur) this.next();
  }

  /** The player acted: what is queued so far speeds up (the batch their action brings plays normally). */
  hurry() {
    if (this.playing) this.hurryThrough = this.lastId;
  }

  pause(on: boolean) {
    if (this.paused === on) return;
    this.paused = on;
    if (!on && this.cur && !this.timer) this.step();
  }

  setSpeed(s: AnimSpeed) {
    this.speed = s;
    if (s === 'instant') this.flush();
  }

  /** Jumps to the end of everything queued. */
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const t of this.deathTimers.values()) clearTimeout(t);
    this.deathTimers.clear();
    const last = this.queue.at(-1)?.after ?? this.cur?.batch.after;
    this.queue = [];
    this.cur = null;
    if (last) {
      this.view = idleView(last);
      this.emit();
    }
  }

  /** Milliseconds until the queued playback is over (estimate, for pacing the bot). */
  busyFor(): number {
    if (this.paused && this.playing) return 1000;
    if (!this.playing) return 0;
    const r = this.rate();
    const rest = this.queue.reduce((s, b) => s + b.beats.reduce((t, x) => t + x.gap, 0), 0) * r;
    const curRest = this.cur ? this.cur.batch.beats.slice(this.cur.played).reduce((t, x) => t + x.gap, 0) * r : 0;
    return Math.max(0, this.endsAt - performance.now()) + rest + curRest;
  }

  dispose() {
    this.flush();
    this.listeners.clear();
  }

  private emit() {
    // cards drawn in batches still waiting in line stay hidden too (story 12.5)
    const queued = this.queue.flatMap((b) => drawnBy(b.events));
    if (queued.length) this.view = { ...this.view, incoming: new Set([...this.view.incoming, ...queued]) };
    for (const l of this.listeners) l();
  }

  private refresh() {
    const c = this.cur;
    if (!c) return;
    this.view = shownView(this.catalog, c.batch.before, c.batch.after, c.batch.events, c.played, new Set(c.held));
    this.emit();
  }

  private next() {
    const batch = this.queue.shift();
    if (!batch) {
      this.cur = null;
      return;
    }
    this.cur = { batch, played: 0, held: new Set() };
    this.step();
  }

  private step() {
    this.timer = null;
    const c = this.cur;
    if (!c || this.paused) return;
    const r = this.rate();
    if (r === 0) {
      // instant: no animation, the view lands on the batch's end
      c.played = c.batch.beats.length;
      c.held.clear();
      this.view = idleView(c.batch.after);
      this.emit();
      return this.next();
    }
    if (c.played >= c.batch.beats.length) {
      if (c.held.size) return; // the last death (or return to hand) ends the batch
      this.view = idleView(c.batch.after);
      this.emit();
      return this.next();
    }
    // beats without duration (draws, coins…) are played together with the next timed one
    let ms = 0;
    while (c.played < c.batch.beats.length && ms === 0) {
      const beat = c.batch.beats[c.played]!;
      c.played++;
      ms = Math.round(beat.gap * r);
      this.begin(c, beat, ms);
      this.onCue({ beat, ms, rate: r, before: c.batch.before, after: c.batch.after, events: c.batch.events });
    }
    this.refresh();
    this.endsAt = performance.now() + ms;
    this.timer = setTimeout(() => this.step(), ms);
  }

  private begin(c: NonNullable<Playback['cur']>, beat: Beat, ms: number) {
    const e = beat.event;
    trace(e.type, 'start', 'iid' in e ? (e.iid as string) : undefined);
    if (e.type !== 'cardDestroyed' && e.type !== 'returnedToHand') return;
    c.held.add(e.iid);
    const t = setTimeout(() => {
      this.deathTimers.delete(e.iid);
      if (this.cur !== c) return;
      c.held.delete(e.iid);
      trace(e.type, 'end', e.iid);
      this.refresh();
      if (c.played >= c.batch.beats.length && !c.held.size && !this.timer) this.step();
    }, ms);
    this.deathTimers.set(e.iid, t);
  }
}

export const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
