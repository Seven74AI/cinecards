import { apply } from './apply.ts';
import { abilityTargets, attackTargets, canAttack, canUseAbility, playTargets } from './query.ts';
import type { Action, Catalog, GameState, PlayerId, Target } from './types.ts';

/** Tiny seeded RNG for the bot, independent from the game RNG. */
export function botRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickOne = <T>(rnd: () => number, list: T[]): T | undefined => list[Math.floor(rnd() * list.length)];

function sample(rnd: () => number, list: string[], n: number): string[] {
  const pool = [...list];
  const out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!);
  return out;
}

const toTargets = (rnd: () => number, reqs: { count: number; options: string[] }[]): Target[] =>
  reqs.flatMap((r) => sample(rnd, r.options, r.count).map((iid) => ({ kind: 'card', iid }) as Target));

/** Candidate actions for `player` (playable cards, abilities, attacks). Not all are guaranteed legal. */
export function candidateActions(catalog: Catalog, state: GameState, player: PlayerId, rnd: () => number): Action[] {
  const p = state.players[player];
  const pending = state.pending;
  if (pending) {
    if (pending.player !== player) return [];
    if (pending.kind === 'pick') return [{ type: 'choose', player, picks: sample(rnd, pending.options, pending.count) }];
    const opt = pickOne(rnd, pending.options)!;
    return [{ type: 'react', player, iid: opt.iid, ability: opt.ability }, { type: 'pass', player }];
  }
  if (state.active !== player || state.phase === 'finished') return [];
  const out: Action[] = [];
  for (const iid of p.hand) {
    const card = catalog.get(state.instances[iid]!.cardId)!;
    if ((card.cost ?? 0) > p.coins) continue;
    const option = card.abilities.some((a) => a.effects?.some((e) => e.op === 'chooseOne')) ? Math.floor(rnd() * 2) : undefined;
    out.push({ type: 'playCard', player, iid, option, targets: toTargets(rnd, playTargets(catalog, state, player, iid, option)) });
  }
  const board = [...p.characters, ...p.terrains, ...p.spells].filter((x): x is string => !!x);
  for (const iid of board) {
    const card = catalog.get(state.instances[iid]!.cardId)!;
    card.abilities.forEach((ab, index) => {
      if (ab.kind !== 'active') return;
      if (canUseAbility(catalog, state, player, iid, index)) return;
      out.push({ type: 'useAbility', player, iid, ability: index, option: Math.floor(rnd() * 2), targets: toTargets(rnd, abilityTargets(catalog, state, player, iid, index)) });
    });
  }
  for (const iid of p.characters) {
    if (!iid || canAttack(catalog, state, iid)) continue;
    const target = pickOne(rnd, attackTargets(catalog, state, iid));
    if (target) out.push({ type: 'attack', player, attacker: iid, target });
  }
  return out;
}

/** Plays one decision for `player` with a random-but-legal policy. Returns the new state, or null if nothing to do. */
export function botStep(catalog: Catalog, state: GameState, player: PlayerId, rnd: () => number): { state: GameState; action: Action } | null {
  const tries = candidateActions(catalog, state, player, rnd);
  while (tries.length) {
    const action = tries.splice(Math.floor(rnd() * tries.length), 1)[0]!;
    const r = apply(catalog, state, action);
    if (r.ok) return { state: r.state, action };
  }
  if (state.active === player && !state.pending && state.phase !== 'finished') {
    const r = apply(catalog, state, { type: 'endTurn', player });
    if (r.ok) return { state: r.state, action: { type: 'endTurn', player } };
  }
  return null;
}
