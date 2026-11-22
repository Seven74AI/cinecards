import type { ApplyResult, PlayerId, RuleError, Target } from '../types.ts';
import { cardOf, inst, isSilenced, onBoard, type Eff, type G } from '../ctx.ts';
import { counterAttack, canAttack } from '../combat/combat.ts';
import { enqueueUse, queueOf, settle } from '../effects/triggers.ts';

const err = (code: RuleError['code'], params?: RuleError['params']): ApplyResult => ({ ok: false, error: params ? { code, params } : { code } });

/** Ability kinds a player uses from the table. */
export const USABLE_KINDS = ['attack', 'active', 'choice'] as const;

/**
 * Why an ability cannot be used right now, or null.
 * - attack ability (story 11.4): instead of the normal attack, once per turn, same eligibility as an attack (haste included)
 * - legacy active / choice: once per card placement
 * `cooldown` and `oncePerGame` markers apply to both.
 */
export function abilityBlocked(g: G, player: PlayerId, iid: string, index: number): RuleError | null {
  const where = onBoard(g, iid);
  if (!where || where.player !== player) return { code: 'NOT_ON_BOARD' };
  const ab = cardOf(g, iid).abilities[index];
  if (!ab || !(USABLE_KINDS as readonly string[]).includes(ab.kind)) return { code: 'NO_SUCH_ABILITY' };
  if (isSilenced(g, iid)) return { code: 'SILENCED' };
  const effects = (ab.effects ?? []) as Eff[];
  const i = inst(g, iid);
  if (ab.kind === 'attack') {
    if (i.abilityTurns?.[index] === g.s.players[player].turnNumber) return { code: 'ABILITY_USED' };
    const cannot = canAttack(g, iid);
    if (cannot) return cannot;
  }
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
  if (ab.kind !== 'attack' && i.usedAbilities.includes(index)) return { code: 'ABILITY_USED' };
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
  if (ab.kind === 'attack') i.attacksUsed += 1; // replaces the normal attack
  if (effects.some((e) => e.op === 'oncePerGame')) g.s.players[player].usedOncePerGame.push(`${cardOf(g, iid).id}:${index}`);
  enqueueUse(g, {
    source: iid,
    ability: index,
    player,
    trigger: ab.kind as 'attack' | 'active' | 'choice',
    ...(option !== undefined ? { option } : {}),
    ...(targets.length ? { targets: [...targets] } : {}),
  });
  settle(g, true);
  return { ok: true, state: g.s, events: g.ev };
}

export function react(g: G, player: PlayerId, iid: string, index: number, target: Target | undefined): ApplyResult {
  const pending = g.s.pending;
  if (!pending || pending.kind !== 'reaction' || pending.player !== player) return err('NOTHING_PENDING');
  if (!pending.options.some((o) => o.iid === iid && o.ability === index) || !onBoard(g, iid)) return err('INVALID_CHOICE');
  const ab = cardOf(g, iid).abilities[index]!;
  g.s.pending = null;
  inst(g, iid).reactedOn = pending.key;
  g.ev.push({ type: 'abilityUsed', iid, ability: index, name: ab.name, player, trigger: 'reaction' });
  const bad = counterAttack(g, player, iid, target);
  if (bad) {
    g.s.pending = pending;
    return { ok: false, error: bad };
  }
  settle(g, false);
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
  const min = pending.min ?? pending.count; // older states: exactly `count`
  if (unique.length < min || unique.length > pending.count || !unique.every((p) => pending.options.includes(p))) return err('INVALID_CHOICE', { count: pending.count });
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
  settle(g, true);
  return { ok: true, state: g.s, events: g.ev };
}

/** Answers a triggered ability's target prompt: one list of picks per request (story 11.4). */
export function chooseTargets(g: G, player: PlayerId, targets: string[][]): ApplyResult {
  const pending = g.s.pending;
  if (!pending || pending.kind !== 'targets' || pending.player !== player) return err('NOTHING_PENDING');
  const item = queueOf(g)[0];
  if (!item) return err('NOTHING_PENDING');
  const picks: string[][] = [];
  for (const [k, r] of pending.requests.entries()) {
    const group = [...new Set(targets[k] ?? [])];
    if (group.length < r.min || group.length > r.count || !group.every((t) => r.options.includes(t))) return err('INVALID_CHOICE', { count: r.count });
    picks.push(group);
  }
  item.picks = picks;
  g.s.pending = null;
  settle(g, true);
  return { ok: true, state: g.s, events: g.ev };
}

/** Answers a triggered ability's "choose one" prompt. */
export function chooseOption(g: G, player: PlayerId, option: number): ApplyResult {
  const pending = g.s.pending;
  if (!pending || pending.kind !== 'option' || pending.player !== player) return err('NOTHING_PENDING');
  const item = queueOf(g)[0];
  if (!item) return err('NOTHING_PENDING');
  if (!Number.isInteger(option) || option < 0 || option >= pending.choices) return err('INVALID_CHOICE', { count: pending.choices });
  item.option = option;
  g.s.pending = null;
  settle(g, true);
  return { ok: true, state: g.s, events: g.ev };
}
