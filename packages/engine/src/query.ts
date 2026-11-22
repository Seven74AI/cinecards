/**
 * Read-only helpers for UIs and bots. They never change state.
 */
import type { Catalog, GameState, PlayerId, RuleError, Target } from './types.ts';
import { auraModifiers, cardOf, characters, cycleActive, newG, stats, turnsUntilCycle, type Eff } from './ctx.ts';
import { computeStats as baseStats, type ComputedStats } from './state/compute-stats.ts';
import { attacksAllowed as allowed, canAttack as can } from './combat/combat.ts';
import { abilityBlocked } from './play/abilities.ts';
import { entryEffects } from './play/play.ts';
import { targetRequests } from './effects/targets.ts';

/** Current stats including auras, with every modifier source (architecture P2). */
export function computeStats(catalog: Catalog, state: GameState, iid: string): ComputedStats {
  const g = newG(catalog, state);
  return state.instances[iid] && characters(g).some((b) => b.iid === iid) ? baseStats(catalog, state, iid, auraModifiers(g, iid)) : baseStats(catalog, state, iid);
}
export const canAttack = (catalog: Catalog, state: GameState, iid: string): RuleError | null => can(newG(catalog, state), iid);
export const attacksAllowed = (catalog: Catalog, state: GameState, iid: string): number => allowed(newG(catalog, state), iid);
export const canUseAbility = (catalog: Catalog, state: GameState, player: PlayerId, iid: string, index: number): RuleError | null =>
  abilityBlocked(newG(catalog, state), player, iid, index);

/** Turns left before a card's "every N turns" passive is active (0 = active now), or null if none. */
export function cycleCountdown(catalog: Catalog, state: GameState, iid: string): number | null {
  const g = newG(catalog, state);
  const card = cardOf(g, iid);
  for (const ab of card.abilities) for (const e of (ab.effects ?? []) as Eff[]) if (typeof e.op === 'string' && e.op.startsWith('cycle')) return turnsUntilCycle(g, iid, e.every ?? 2);
  return null;
}
export const isCycleActive = (catalog: Catalog, state: GameState, iid: string, every: number): boolean => cycleActive(newG(catalog, state), iid, every);

/** Targets the player must choose to play a card from hand (option = choice index). */
export function playTargets(catalog: Catalog, state: GameState, player: PlayerId, iid: string, option?: number) {
  const g = newG(catalog, state);
  const card = cardOf(g, iid);
  const fromSpell = card.category === 'spell' || card.category === 'equipment';
  return entryEffects(card.abilities, card.category, option).flatMap(({ effects }) => targetRequests(g, effects, { player, source: iid, fromSpell }));
}

/** Targets the player must choose to use an ability of a card on the table. */
export function abilityTargets(catalog: Catalog, state: GameState, player: PlayerId, iid: string, index: number) {
  const g = newG(catalog, state);
  const ab = cardOf(g, iid).abilities[index];
  return ab ? targetRequests(g, (ab.effects ?? []) as Eff[], { player, source: iid, fromSpell: false }) : [];
}

/** Legal attack targets for a character. */
export function attackTargets(catalog: Catalog, state: GameState, iid: string): Target[] {
  const g = newG(catalog, state);
  const me = state.instances[iid]!.owner;
  const foe: PlayerId = me === 0 ? 1 : 0;
  const foes = characters(g, foe);
  const precision = state.instances[iid]!.statuses.some((s) => s.kind === 'precision');
  const out: Target[] = foes.map((b) => ({ kind: 'card', iid: b.iid }));
  if (foes.length === 0 || precision) out.push({ kind: 'player', player: foe });
  return out;
}

export { stats as statsInContext };
