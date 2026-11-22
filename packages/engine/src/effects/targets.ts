import { randomInt } from '../rng.ts';
import type { PlayerId, Target } from '../types.ts';
import { board, cardOf, characters, hasStatus, immuneTo, inst, matches, stats, type BoardEntry, type Eff, type G } from '../ctx.ts';

/** Who controls an effect, and what the player chose when declaring it. */
export interface EffectCtx {
  source: string; // instance id of the card producing the effect
  player: PlayerId; // controller
  targets: Target[]; // chosen targets, consumed in order
  fromSpell: boolean;
  label: string;
  option?: number;
  /** Targets resolved by the previous effect (spec 'previous'). */
  last?: string[];
  /** Attack-time context for onAttacked / onAttack hooks. */
  attacker?: string;
  defender?: string;
  cancelAttack?: boolean;
}

/** Target specs that need the player to choose (used by the UI and by the engine to validate). */
export const CHOSEN_SPECS = ['chosen', 'chosenAlly', 'chosenEnemy', 'chosenCard', 'chosenEnemyOrSelfAlly'] as const;

/** Can an effect from `ctx` affect this board card? (immunity, insensibility, spell immunity) */
export function affectable(g: G, ctx: Pick<EffectCtx, 'player' | 'fromSpell'>, entry: BoardEntry): boolean {
  if (entry.player === ctx.player) return true;
  if (hasStatus(g, entry.iid, 'immune') || hasStatus(g, entry.iid, 'insensible')) return false;
  if (ctx.fromSpell && (hasStatus(g, entry.iid, 'spellImmune') || immuneTo(g, entry.iid, 'spells'))) return false;
  return true;
}

/** Legal options for a target spec, before choosing. */
export function candidates(g: G, spec: string, ctx: Pick<EffectCtx, 'player' | 'source' | 'fromSpell'>, filter?: Eff['filter']): BoardEntry[] {
  const pool = spec === 'chosenCard' ? board(g) : characters(g);
  const who =
    spec === 'chosenAlly' || spec === 'allAllies'
      ? 'allies'
      : spec === 'otherAllies'
        ? 'otherAllies'
        : spec === 'chosenEnemy' || spec === 'allEnemies' || spec === 'randomEnemy' || spec === 'highestAtkEnemy'
          ? 'enemies'
          : 'any';
  return pool.filter((b) => matches(g, ctx.player, ctx.source, b, who, filter) && affectable(g, ctx, b));
}

/** Resolves a target spec into instance ids, consuming chosen targets from the context. */
export function resolveTargets(g: G, e: Eff, ctx: EffectCtx): string[] {
  if (e.target === 'previous') return (ctx.last ?? []).filter((iid) => g.s.instances[iid]);
  const out = resolveFresh(g, e, ctx);
  ctx.last = out;
  return out;
}

function resolveFresh(g: G, e: Eff, ctx: EffectCtx): string[] {
  const spec: string = e.target ?? 'self';
  const count: number = e.count ?? 1;
  if (spec === 'self') return [ctx.source];
  if (spec === 'attacker') return ctx.attacker ? [ctx.attacker] : [];
  if (spec === 'defender') return ctx.defender ? [ctx.defender] : [];
  const pool = candidates(g, spec, ctx, e.filter);
  if (spec === 'all' || spec === 'allAllies' || spec === 'allEnemies' || spec === 'otherAllies') return pool.map((b) => b.iid);
  if (spec === 'allBoard') return board(g).filter((b) => affectable(g, ctx, b)).map((b) => b.iid);
  if (spec === 'randomEnemy') return pool.length ? [pool[randomInt(g.s, pool.length)]!.iid] : [];
  if (spec === 'highestAtkEnemy') {
    const sorted = [...pool].sort((a, b) => stats(g, b.iid).atk - stats(g, a.iid).atk);
    return sorted[0] ? [sorted[0].iid] : [];
  }
  // chosen*: take the declared targets that are legal; fill missing ones randomly (bots, tests)
  const legal = new Set(pool.map((b) => b.iid));
  const picked: string[] = [];
  while (picked.length < count && ctx.targets.length > 0) {
    const t = ctx.targets.shift()!;
    if (t.kind === 'card' && legal.has(t.iid) && !picked.includes(t.iid)) picked.push(t.iid);
  }
  if (picked.length === 0 && e.optional !== true) {
    const rest = pool.filter((b) => !picked.includes(b.iid));
    while (picked.length < count && rest.length > 0) picked.push(rest.splice(randomInt(g.s, rest.length), 1)[0]!.iid);
  }
  return picked;
}

/** All chosen-target requests of an effect list, for the UI. */
export function targetRequests(g: G, effects: Eff[], ctx: Pick<EffectCtx, 'player' | 'source' | 'fromSpell'>): { spec: string; count: number; options: string[] }[] {
  const out: { spec: string; count: number; options: string[] }[] = [];
  const walk = (list: Eff[]) => {
    for (const e of list) {
      if (e.target && (CHOSEN_SPECS as readonly string[]).includes(e.target)) {
        out.push({ spec: e.target, count: e.count ?? 1, options: candidates(g, e.target, ctx, e.filter).map((b) => b.iid) });
      }
      if (Array.isArray(e.effects)) walk(e.effects);
      if (Array.isArray(e.branches)) for (const br of e.branches) walk(br.effects ?? []);
      if (Array.isArray(e.else)) walk(e.else);
    }
  };
  walk(effects);
  return out;
}

export const ownerOf = (g: G, iid: string): PlayerId => inst(g, iid).owner;
export const nameOf = (g: G, iid: string): string => cardOf(g, iid).name;
