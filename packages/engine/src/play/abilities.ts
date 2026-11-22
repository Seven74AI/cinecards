import type { ApplyResult, PlayerId, RuleError, Target } from '../types.ts';
import { cardOf, inst, isSilenced, onBoard, type Eff, type G } from '../ctx.ts';
import { checkWinner, processDeaths } from '../effects/core.ts';
import { runEffects } from '../effects/run.ts';
import { counterAttack } from '../combat/combat.ts';
import { offerReaction } from './reactions.ts';

const err = (code: RuleError['code'], params?: RuleError['params']): ApplyResult => ({ ok: false, error: params ? { code, params } : { code } });

/** Why an active ability cannot be used right now, or null. Rule: once per card placement, unless a marker says otherwise. */
export function abilityBlocked(g: G, player: PlayerId, iid: string, index: number): RuleError | null {
  const where = onBoard(g, iid);
  if (!where || where.player !== player) return { code: 'NOT_ON_BOARD' };
  const ab = cardOf(g, iid).abilities[index];
  if (!ab || (ab.kind !== 'active' && ab.kind !== 'choice')) return { code: 'NO_SUCH_ABILITY' };
  if (isSilenced(g, iid)) return { code: 'SILENCED' };
  const effects = (ab.effects ?? []) as Eff[];
  const i = inst(g, iid);
  const cooldown = effects.find((e) => e.op === 'cooldown');
  if (cooldown) {
    const last = i.abilityTurns?.[index];
    if (last !== undefined && g.s.players[player].turnNumber - last < (cooldown.every ?? 2)) return { code: 'ABILITY_USED' };
    return null;
  }
  if (effects.some((e) => e.op === 'oncePerGame')) {
    if (g.s.players[player].usedOncePerGame.includes(`${cardOf(g, iid).id}:${index}`)) return { code: 'ABILITY_USED' };
    return null;
  }
  if (i.usedAbilities.includes(index)) return { code: 'ABILITY_USED' };
  return null;
}

export function useAbility(g: G, player: PlayerId, iid: string, index: number, targets: Target[], option: number | undefined): ApplyResult {
  const blocked = abilityBlocked(g, player, iid, index);
  if (blocked) return { ok: false, error: blocked };
  const ab = cardOf(g, iid).abilities[index]!;
  const effects = (ab.effects ?? []) as Eff[];
  const i = inst(g, iid);
  i.usedAbilities.push(index);
  i.abilityTurns = { ...(i.abilityTurns ?? {}), [index]: g.s.players[player].turnNumber };
  if (effects.some((e) => e.op === 'oncePerGame')) g.s.players[player].usedOncePerGame.push(`${cardOf(g, iid).id}:${index}`);
  g.ev.push({ type: 'abilityUsed', iid, ability: index, name: ab.name, player });
  runEffects(g, effects, { source: iid, player, targets: [...targets], fromSpell: false, label: ab.name, ...(option !== undefined ? { option } : {}) });
  processDeaths(g);
  checkWinner(g);
  offerReaction(g, player);
  return { ok: true, state: g.s, events: g.ev };
}

export function react(g: G, player: PlayerId, iid: string, index: number, target: Target | undefined): ApplyResult {
  const pending = g.s.pending;
  if (!pending || pending.kind !== 'reaction' || pending.player !== player) return err('NOTHING_PENDING');
  if (!pending.options.some((o) => o.iid === iid && o.ability === index) || !onBoard(g, iid)) return err('INVALID_CHOICE');
  const ab = cardOf(g, iid).abilities[index]!;
  g.s.pending = null;
  inst(g, iid).reactedOn = pending.key;
  g.ev.push({ type: 'abilityUsed', iid, ability: index, name: ab.name, player });
  const bad = counterAttack(g, player, iid, target);
  if (bad) {
    g.s.pending = pending;
    return { ok: false, error: bad };
  }
  processDeaths(g);
  checkWinner(g);
  return { ok: true, state: g.s, events: g.ev };
}

export function pass(g: G, player: PlayerId): ApplyResult {
  const pending = g.s.pending;
  if (!pending || pending.kind !== 'reaction' || pending.player !== player) return err('NOTHING_PENDING');
  g.s.pending = null;
  g.ev.push({ type: 'reactionPassed', player });
  return { ok: true, state: g.s, events: g.ev };
}

export function choose(g: G, player: PlayerId, picks: string[]): ApplyResult {
  const pending = g.s.pending;
  if (!pending || pending.kind !== 'pick' || pending.player !== player) return err('NOTHING_PENDING');
  const unique = [...new Set(picks)];
  if (unique.length !== pending.count || !unique.every((p) => pending.options.includes(p))) return err('INVALID_CHOICE', { count: pending.count });
  const pile = g.s.mode === 'shared' ? g.s.sharedDeck : g.s.players[player].deck;
  const hand = g.s.players[player].hand;
  for (const iid of unique) {
    pile.splice(pile.indexOf(iid), 1);
    inst(g, iid).owner = player;
    if (hand.length >= 10) g.s.players[player].graveyard.push(iid);
    else hand.push(iid);
  }
  g.s.pending = null;
  g.ev.push({ type: 'picked', player, count: unique.length });
  offerReaction(g, player);
  return { ok: true, state: g.s, events: g.ev };
}
