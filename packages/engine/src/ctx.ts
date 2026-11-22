import type { Ability, Card } from '@cinecards/cards';
import type { Catalog, CardInstance, GameEvent, GameState, Modifier, PlayerId, SlotKind, Status } from './types.ts';
import { computeStats, type ComputedStats } from './state/compute-stats.ts';
import { SLOT_KINDS } from './state/helpers.ts';

/** Mutable working context for one action: catalog, the cloned state, emitted events. */
export interface G {
  catalog: Catalog;
  s: GameState;
  ev: GameEvent[];
  chain: number;
  chainStopped: boolean;
  /** Abilities already fired in the current chain ("iid:index"), for the anti-loop guard. */
  fired: Set<string>;
}

export type Eff = { op: string; [key: string]: any };

export const newG = (catalog: Catalog, s: GameState, ev: GameEvent[] = []): G => ({ catalog, s, ev, chain: 0, chainStopped: false, fired: new Set() });

export const inst = (g: G, iid: string): CardInstance => {
  const i = g.s.instances[iid];
  if (!i) throw new Error(`unknown instance ${iid}`);
  return i;
};
export const cardOf = (g: G, iid: string): Card => {
  const c = g.catalog.get(inst(g, iid).cardId);
  if (!c) throw new Error(`unknown card for ${iid}`);
  return c;
};

export interface BoardEntry {
  iid: string;
  player: PlayerId;
  kind: SlotKind;
  slot: number;
}

export function board(g: G): BoardEntry[] {
  const out: BoardEntry[] = [];
  for (const player of [0, 1] as PlayerId[]) {
    for (const kind of SLOT_KINDS) {
      g.s.players[player][kind].forEach((iid, slot) => {
        if (iid) out.push({ iid, player, kind, slot });
      });
    }
  }
  return out;
}
export const onBoard = (g: G, iid: string): BoardEntry | undefined => board(g).find((b) => b.iid === iid);
export const characters = (g: G, player?: PlayerId): BoardEntry[] => board(g).filter((b) => b.kind === 'characters' && (player === undefined || b.player === player));

export const hasStatus = (g: G, iid: string, kind: Status['kind']): boolean => inst(g, iid).statuses.some((s) => s.kind === kind);
export const isSilenced = (g: G, iid: string): boolean => hasStatus(g, iid, 'silence') && !immuneTo(g, iid, 'silence');

/** Effects of a card's passive abilities with a given op (empty when silenced). */
export function passives(g: G, iid: string, op: string): (Eff & { _ability: Ability; _index: number })[] {
  if (isSilencedRaw(g, iid)) return [];
  const card = cardOf(g, iid);
  const out: (Eff & { _ability: Ability; _index: number })[] = [];
  card.abilities.forEach((ab, index) => {
    if (ab.kind !== 'passive') return;
    for (const e of (ab.effects ?? []) as Eff[]) if (e.op === op) out.push({ ...e, _ability: ab, _index: index });
  });
  return out;
}
// silence check without recursion through immuneTo -> passives
function isSilencedRaw(g: G, iid: string): boolean {
  if (!inst(g, iid).statuses.some((s) => s.kind === 'silence')) return false;
  const card = cardOf(g, iid);
  return !card.abilities.some((ab) => ab.kind === 'passive' && (ab.effects ?? []).some((e: any) => e.op === 'immuneTo' && (e.kinds as string[]).includes('silence')));
}
export function immuneTo(g: G, iid: string, kind: string): boolean {
  const card = cardOf(g, iid);
  return card.abilities.some((ab) => ab.kind === 'passive' && (ab.effects ?? []).some((e: any) => e.op === 'immuneTo' && (e.kinds as string[]).includes(kind)));
}

/** Does `target` match an aura/filter relative to the source owner? */
export function matches(g: G, srcOwner: PlayerId, srcIid: string, target: BoardEntry, who: string, filter?: Eff['filter']): boolean {
  if (who === 'self' && target.iid !== srcIid) return false;
  if (who === 'allies' && target.player !== srcOwner) return false;
  if (who === 'otherAllies' && (target.player !== srcOwner || target.iid === srcIid)) return false;
  if (who === 'enemies' && target.player === srcOwner) return false;
  if (filter) {
    const c = cardOf(g, target.iid);
    if (filter.set && c.set !== filter.set) return false;
    if (filter.ids && !(filter.ids as string[]).includes(c.id)) return false;
    if (filter.role && !c.role.includes(filter.role)) return false;
  }
  return true;
}

export const cardOnBoard = (g: G, player: PlayerId, cardId: string): boolean => board(g).some((b) => b.player === player && inst(g, b.iid).cardId === cardId);

/** Aura modifiers that currently apply to a character (recomputed, never stored). */
export function auraModifiers(g: G, iid: string): Modifier[] {
  const target = onBoard(g, iid);
  if (!target || target.kind !== 'characters') return [];
  const out: Modifier[] = [];
  for (const src of board(g)) {
    for (const a of passives(g, src.iid, 'aura')) {
      if (!matches(g, src.player, src.iid, target, a.who ?? 'allies', a.filter)) continue;
      const cond = a.if as Eff | undefined;
      if (cond?.allyOnBoard && !cardOnBoard(g, src.player, cond.allyOnBoard)) continue;
      if (cond?.enemyOnBoard && !cardOnBoard(g, (1 - src.player) as PlayerId, cond.enemyOnBoard)) continue;
      if (cond?.selfHpBelow !== undefined) {
        const base = computeStats(g.catalog, g.s, iid);
        if (base.hp >= cond.selfHpBelow) continue;
      }
      out.push({ source: src.iid, label: a._ability.name, atk: a.atk ?? 0, hp: a.hp ?? 0 });
    }
  }
  return out;
}

export const stats = (g: G, iid: string): ComputedStats => computeStats(g.catalog, g.s, iid, auraModifiers(g, iid));

/** "Every N turns" (architecture P4): active on the N-th owner turn after play, then every N. */
export function cycleActive(g: G, iid: string, every: number): boolean {
  return turnsUntilCycle(g, iid, every) === 0;
}

/** 0 when the cycle is active this turn; otherwise owner turns left before it activates. */
export function turnsUntilCycle(g: G, iid: string, every: number): number {
  const i = inst(g, iid);
  if (i.playedOnTurn <= 0) return every;
  const elapsed = g.s.players[i.owner].turnNumber - i.playedOnTurn;
  if (elapsed <= 0) return every;
  const r = elapsed % every;
  return r === 0 ? 0 : every - r;
}

export function coinCap(g: G, player: PlayerId): number {
  let cap = 10;
  for (const b of board(g)) if (b.player === player) for (const e of passives(g, b.iid, 'coinCap')) cap += e.amount ?? 0;
  return cap;
}
