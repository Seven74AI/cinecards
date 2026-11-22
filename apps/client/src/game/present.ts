import { computeStats, type Catalog, type ComputedStats, type GameEvent, type GameState, type PlayerId, type SlotKind, type Status } from '@cinecards/engine';

/**
 * Presentation layer (story 12.1): what the table shows while an event batch is replayed.
 *
 * The engine stays the referee: `before` and `after` are two engine states and the shown state is only a
 * view in between, moved forward one event at a time. Once every event is played (and no card is still
 * dying) the shown state is exactly `after`. Anything this view cannot rebuild from the events (auras,
 * multi-body cards, heal caps) simply snaps to the engine's values at the end of the batch.
 */
export interface ShownView {
  state: GameState;
  /** Shown stats of characters whose stats differ from a plain `computeStats(state)` while replaying. */
  stats: Record<string, ComputedStats>;
  /** Shown statuses, for the same cards. */
  statuses: Record<string, Status[]>;
  /** Destroyed cards still in their slot for their death animation. */
  dying: ReadonlySet<string>;
  /** Cards sent back to hand, still in their slot while they lift off (story 12.4). */
  returning: ReadonlySet<string>;
  /** Cards drawn by events not played yet: the hand (real state) keeps them hidden until their beat (story 12.5). */
  incoming: ReadonlySet<string>;
}

const ZONES: SlotKind[] = ['characters', 'terrains', 'spells'];

export const idleView = (state: GameState): ShownView => ({ state, stats: {}, statuses: {}, dying: new Set(), returning: new Set(), incoming: new Set() });

/** Cards drawn by these events (story 12.5). */
export const drawnBy = (events: GameEvent[]): string[] => events.flatMap((e) => (e.type === 'cardDrawn' ? [e.iid] : []));

const onBoard = (s: GameState, iid: string): { player: PlayerId; zone: SlotKind; slot: number } | null => {
  for (const player of [0, 1] as const)
    for (const zone of ZONES) {
      const slot = s.players[player][zone].indexOf(iid);
      if (slot >= 0) return { player, zone, slot };
    }
  return null;
};

type Delta = { atk: number; hp: number };
const deltaOf = (e: GameEvent): { iid: string; d: Delta } | null => {
  if (e.type === 'damageDealt') return { iid: e.target, d: { atk: 0, hp: -e.amount } };
  if (e.type === 'healed') return { iid: e.target, d: { atk: 0, hp: e.amount } };
  if (e.type === 'modified') return { iid: e.target, d: { atk: e.atk, hp: e.hp } };
  return null;
};

/**
 * The state shown after the first `played` events of the batch, with the cards of `held` (dying, or going
 * back to hand) still in place.
 * Pure: the same inputs always give the same view.
 */
export function shownView(catalog: Catalog, before: GameState, after: GameState, events: GameEvent[], played: number, held: ReadonlySet<string> = new Set()): ShownView {
  if (played >= events.length && held.size === 0) return idleView(after);
  const done = events.slice(0, played);
  const todo = events.slice(played);

  // board: forward from `before`
  const zones = ([0, 1] as const).map((p) => Object.fromEntries(ZONES.map((z) => [z, [...before.players[p][z]]])) as Record<SlotKind, (string | null)[]>);
  const remove = (iid: string) => {
    for (const z of zones) for (const zone of ZONES) z[zone] = z[zone].map((x) => (x === iid ? null : x));
  };
  const place = (iid: string, player: PlayerId, zone: SlotKind, slot: number | undefined) => {
    const at = slot ?? (() => {
      const where = onBoard(after, iid);
      return where && where.player === player && where.zone === zone ? where.slot : zones[player]![zone].indexOf(null);
    })();
    if (at < 0 || at >= zones[player]![zone].length) return;
    remove(iid);
    zones[player]![zone][at] = iid;
  };
  let heroHp: [number, number] = [before.players[0].hp, before.players[1].hp];
  const dying = new Set<string>();
  const returning = new Set<string>();
  for (const e of done) {
    if (e.type === 'cardPlayed' && e.zone !== 'resolved') place(e.iid, e.player, e.zone, e.slot);
    else if (e.type === 'summoned') {
      const where = onBoard(after, e.iid);
      if (where) place(e.iid, where.player, where.zone, where.slot);
    } else if (e.type === 'returnedToHand') {
      if (held.has(e.iid)) returning.add(e.iid);
      else remove(e.iid);
    } else if (e.type === 'cardDestroyed') {
      if (held.has(e.iid)) dying.add(e.iid);
      else remove(e.iid);
    }
    else if (e.type === 'playerDamaged') heroHp = e.player === 0 ? [e.hp, heroHp[1]] : [heroHp[0], e.hp];
  }

  const instances = { ...after.instances };
  const players = ([0, 1] as const).map((p) => ({ ...after.players[p], ...zones[p], hp: heroHp[p] })) as GameState['players'];
  const state: GameState = { ...after, players, instances };

  const stats: Record<string, ComputedStats> = {};
  const statuses: Record<string, Status[]> = {};
  const sum = (list: GameEvent[], iid: string): Delta => {
    const t = { atk: 0, hp: 0 };
    for (const e of list) {
      const x = deltaOf(e);
      if (x && x.iid === iid) {
        t.atk += x.d.atk;
        t.hp += x.d.hp;
      }
    }
    return t;
  };
  const shift = (s: ComputedStats, d: Delta): ComputedStats => (s.bodies || (!d.atk && !d.hp) ? s : { ...s, atk: Math.max(0, s.atk + d.atk), hp: Math.max(0, s.hp + d.hp) });
  const safeStats = (s: GameState, iid: string): ComputedStats | null => {
    try {
      return computeStats(catalog, s, iid);
    } catch {
      return null;
    }
  };

  for (const iid of players.flatMap((p) => p.characters)) {
    if (!iid) continue;
    const wasThere = !!onBoard(before, iid);
    const staysThere = onBoard(after, iid)?.zone === 'characters';
    const saved = done.some((e) => e.type === 'deathPrevented' && e.iid === iid);
    // cards already on the table move forward from `before`; new arrivals (and saved cards) unwind from `after`
    const fromAfter = staysThere && (!wasThere || saved);
    if (!fromAfter && before.instances[iid]) instances[iid] = before.instances[iid]!;
    const base = safeStats(fromAfter ? after : before, iid);
    if (base) stats[iid] = fromAfter ? shift(base, neg(sum(todo, iid))) : shift(base, sum(done, iid));
    const pendingStatus = new Set(todo.flatMap((e) => (e.type === 'statusApplied' && e.target === iid ? [e.status] : [])));
    const own = instances[iid]?.statuses ?? [];
    const appliedNow = fromAfter ? [] : done.flatMap((e) => (e.type === 'statusApplied' && e.target === iid && !own.some((s) => s.kind === e.status) ? [{ kind: e.status, source: '', turnsLeft: e.turns }] : []));
    statuses[iid] = [...own.filter((s) => !pendingStatus.has(s.kind)), ...appliedNow];
  }
  for (const p of players)
    for (const zone of ['terrains', 'spells'] as const)
      for (const iid of p[zone]) if (iid && !onBoard(after, iid) && before.instances[iid]) instances[iid] = before.instances[iid]!;

  return { state, stats, statuses, dying, returning, incoming: new Set(drawnBy(todo)) };
}

const neg = (d: Delta): Delta => ({ atk: -d.atk, hp: -d.hp });
