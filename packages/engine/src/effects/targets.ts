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
  /** Targets chosen at trigger time, per effect (story 11.4); consumed one list per resolution. */
  picks?: Map<Eff, string[][]>;
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
export function resolveTargets(g: G, e: Eff, ctx: EffectCtx, key: Eff = e): string[] {
  if (e.target === 'previous') return (ctx.last ?? []).filter((iid) => g.s.instances[iid]);
  const out = resolveFresh(g, e, ctx, key);
  ctx.last = out;
  return out;
}

function resolveFresh(g: G, e: Eff, ctx: EffectCtx, key: Eff): string[] {
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
  const legal = new Set(pool.map((b) => b.iid));
  // chosen at trigger time: one list per request, kept if still legal
  const group = ctx.picks?.get(key)?.shift();
  if (group) return [...new Set(group)].filter((iid) => legal.has(iid)).slice(0, count);
  // targets declared with the action (older clients, tests): the legal ones, in order. Never filled at random (story 11.5).
  const picked: string[] = [];
  while (picked.length < count && ctx.targets.length > 0) {
    const t = ctx.targets.shift()!;
    if (t.kind === 'card' && legal.has(t.iid) && !picked.includes(t.iid)) picked.push(t.iid);
  }
  return picked;
}

/** The card a summonFrom effect would bring, or undefined. */
export function findSummon(g: G, e: Eff, me: PlayerId) {
  const zones: string[] = e.zones ?? ['hand', 'graveyard'];
  const foe: PlayerId = me === 0 ? 1 : 0;
  return Object.values(g.s.instances).find((i) => {
    if (!(e.ids as string[]).includes(i.cardId)) return false;
    const where = board(g).find((b) => b.iid === i.iid);
    if (where) return zones.includes('enemyBoard') && where.player === foe && where.kind === 'characters';
    return ([0, 1] as PlayerId[]).some((p) => {
      const pl = g.s.players[p];
      const mine = p === me;
      return (pl.hand.includes(i.iid) && (zones.includes('anyHand') || (mine && zones.includes('hand')))) ||
        (pl.graveyard.includes(i.iid) && (zones.includes('anyGraveyard') || (mine && zones.includes('graveyard'))));
    });
  });
}

/** "Choose N" means up to N (story 11.5); `exactly: true` or an explicit `min` raises the floor. */
export const minOf = (e: Eff, count: number): number => Math.min(count, typeof e.min === 'number' ? e.min : e.exactly === true ? count : 0);

export interface ChosenRequest {
  spec: string;
  count: number;
  /** Fewest picks allowed. */
  min: number;
  options: string[];
  /** The effect that consumes this request (internal: matches picks to effects). */
  eff: Eff;
}

/**
 * All chosen-target requests of an effect list, in resolution order (UI prompts, bots). Dice branches are
 * all listed (the roll happens after the choice); for chooseOne only the chosen option; a summonFrom's
 * fallback only when nothing can be summoned.
 */
export function targetRequests(g: G, effects: Eff[], ctx: Pick<EffectCtx, 'player' | 'source' | 'fromSpell' | 'option'>): ChosenRequest[] {
  const out: ChosenRequest[] = [];
  const req = (spec: string, e: Eff, count: number) =>
    out.push({ spec, count, min: minOf(e, count), options: candidates(g, spec, ctx, e.filter).map((b) => b.iid), eff: e });
  const walk = (list: Eff[]) => {
    for (const e of list) {
      if (e.op === 'duel') {
        req('chosenAlly', e, 1);
        req('chosenEnemy', e, 1);
        continue;
      }
      if (e.target && (CHOSEN_SPECS as readonly string[]).includes(e.target)) req(e.target, e, e.count ?? 1);
      if (Array.isArray(e.effects)) walk(e.effects);
      if (Array.isArray(e.branches)) for (const br of e.branches) walk(br.effects ?? []);
      if (e.op === 'chooseOne' && Array.isArray(e.options) && ctx.option !== undefined) walk(e.options[Math.min(ctx.option, e.options.length - 1)] ?? []);
      if (Array.isArray(e.else) && (e.op !== 'summonFrom' || !findSummon(g, e, ctx.player))) walk(e.else);
    }
  };
  walk(effects);
  return out;
}

export const ownerOf = (g: G, iid: string): PlayerId => inst(g, iid).owner;
export const nameOf = (g: G, iid: string): string => cardOf(g, iid).name;
