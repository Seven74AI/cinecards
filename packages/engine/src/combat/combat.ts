import { RULES } from '../rules.ts';
import { randomInt } from '../rng.ts';
import type { ApplyResult, PlayerId, RuleError, Target } from '../types.ts';
import { cardOf, characters, cycleActive, hasStatus, inst, matches, onBoard, passives, stats, type G } from '../ctx.ts';
import { checkWinner, damage, damagePlayer, processDeaths } from '../effects/core.ts';
import { runEffects } from '../effects/run.ts';
import type { EffectCtx } from '../effects/targets.ts';
import { offerReaction } from '../play/reactions.ts';

const err = (code: RuleError['code'], params?: RuleError['params']): ApplyResult => ({ ok: false, error: params ? { code, params } : { code } });
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/** Attacks a character may make this turn: 1, or one per living body, or multiAttack, + extraAttack statuses. */
export function attacksAllowed(g: G, iid: string): number {
  const st = stats(g, iid);
  let n: number = st.bodies ? st.bodies.filter((b) => b.alive).length : RULES.ATTACKS_PER_TURN;
  for (const e of passives(g, iid, 'multiAttack')) n = Math.max(n, e.count ?? 1);
  for (const s of inst(g, iid).statuses) if (s.kind === 'extraAttack') n += s.amount ?? 1;
  return n;
}

/** Characters may attack the turn after they arrive, unless a haste passive applies. */
function hasHaste(g: G, iid: string): { selfDamage: number } | null {
  const owner = inst(g, iid).owner;
  for (const e of passives(g, iid, 'haste')) {
    if (e.ifAlly && !characters(g, owner).some((b) => cardOf(g, b.iid).id === e.ifAlly)) continue;
    return { selfDamage: e.selfDamage ?? 0 };
  }
  return null;
}

export function canAttack(g: G, iid: string): RuleError | null {
  const loc = onBoard(g, iid);
  if (!loc || loc.kind !== 'characters') return { code: 'NOT_ON_BOARD' };
  const i = inst(g, iid);
  if (hasStatus(g, iid, 'stunned')) return { code: 'STUNNED' };
  if (i.playedOnTurn >= g.s.players[loc.player].turnNumber && !hasHaste(g, iid)) return { code: 'SUMMONING_SICK' };
  if (i.attacksUsed >= attacksAllowed(g, iid)) return { code: 'NO_ATTACK_LEFT' };
  return null;
}

function validateTarget(g: G, attacker: string, player: PlayerId, target: Target): RuleError | null {
  const foe = other(player);
  if (target.kind === 'player') {
    if (target.player !== foe) return { code: 'INVALID_TARGET' };
    if (characters(g, foe).length > 0 && !hasStatus(g, attacker, 'precision')) return { code: 'TARGET_PROTECTED' };
    return null;
  }
  const tloc = onBoard(g, target.iid);
  if (!tloc || tloc.kind !== 'characters' || tloc.player !== foe) return { code: 'INVALID_TARGET' };
  return null;
}

/** Resolves one strike (used by normal attacks and counter-attacks). */
export function strike(g: G, player: PlayerId, attacker: string, target: Target): void {
  const a = inst(g, attacker);
  a.attackCount = (a.attackCount ?? 0) + 1;
  g.ev.push({ type: 'attackDeclared', player, attacker, target });

  // onAttack passives of the attacker (e.g. Wash Out: a die may send the hit to a random card)
  let finalTarget = target;
  for (const e of passives(g, attacker, 'onAttack')) {
    if (e.randomTargetOn) {
      const roll = randomInt(g.s, 6) + 1;
      g.ev.push({ type: 'diceRolled', player, value: roll, label: e._ability.name });
      if (roll >= e.randomTargetOn[0] && roll <= e.randomTargetOn[1]) {
        const pool = characters(g).filter((b) => b.iid !== attacker);
        if (pool.length) finalTarget = { kind: 'card', iid: pool[randomInt(g.s, pool.length)]!.iid };
      }
    }
  }

  const atkStats = stats(g, attacker);
  let atk = atkStats.atk;

  if (finalTarget.kind === 'player') {
    damagePlayer(g, finalTarget.player, atk);
    checkWinner(g);
    return;
  }

  const defender = finalTarget.iid;
  const dloc = onBoard(g, defender)!;
  // onAttacked passives of the defender (dice that cancel the attack, send the defender home, destroy the attacker)
  const ctx: EffectCtx = { source: defender, player: dloc.player, targets: [], fromSpell: false, label: '', attacker, defender };
  for (const e of passives(g, defender, 'onAttacked')) {
    ctx.label = e._ability.name;
    runEffects(g, e.effects ?? [], ctx);
    if (ctx.cancelAttack || !onBoard(g, attacker) || !onBoard(g, defender)) {
      processDeaths(g);
      return;
    }
  }

  // conditional attack bonuses (Kent, Gomez)
  for (const e of passives(g, attacker, 'attackBonusVs')) {
    if (matches(g, player, attacker, dloc, 'enemies', e.filter)) atk += e.atk ?? 0;
  }

  const ranged =
    hasStatus(g, attacker, 'precision') ||
    passives(g, attacker, 'noRetaliation').some((e) => (e.alternate ? (a.attackCount ?? 1) % 2 === 1 : true));
  const retaliation = ranged ? 0 : stats(g, defender).atk;

  damage(g, defender, atk, { source: attacker, fromAttack: true, sourcePlayer: player });
  if (retaliation > 0 && onBoard(g, attacker)) damage(g, attacker, retaliation, { source: defender, fromAttack: true, sourcePlayer: dloc.player });

  const haste = hasHaste(g, attacker);
  if (haste && haste.selfDamage > 0 && a.playedOnTurn >= g.s.players[player].turnNumber && onBoard(g, attacker)) {
    damage(g, attacker, haste.selfDamage, { source: attacker, fromAttack: false, sourcePlayer: player });
  }

  const dead = processDeaths(g);
  if (dead.includes(defender) && onBoard(g, attacker)) {
    for (const e of passives(g, attacker, 'onKill')) {
      if (e.reattack) a.attacksUsed = Math.max(0, a.attacksUsed - 1);
      if (e.effects) runEffects(g, e.effects, { source: attacker, player, targets: [], fromSpell: false, label: e._ability.name });
    }
  }
  checkWinner(g);
}

export function attack(g: G, player: PlayerId, attacker: string, target: Target): ApplyResult {
  const loc = onBoard(g, attacker);
  if (!loc || loc.kind !== 'characters' || loc.player !== player) return err('NOT_ON_BOARD');
  const blocked = canAttack(g, attacker);
  if (blocked) return { ok: false, error: blocked };
  const bad = validateTarget(g, attacker, player, target);
  if (bad) return { ok: false, error: bad };

  inst(g, attacker).attacksUsed += 1;
  strike(g, player, attacker, target);
  inst(g, attacker).statuses = inst(g, attacker).statuses.filter((s) => s.kind !== 'precision');
  offerReaction(g, player);
  return { ok: true, state: g.s, events: g.ev };
}

/** Counter-attack during the opponent's turn (reaction window). */
export function counterAttack(g: G, player: PlayerId, iid: string, target: Target | undefined): RuleError | null {
  const foe = other(player);
  const t: Target = target ?? (characters(g, foe)[0] ? { kind: 'card', iid: characters(g, foe)[0]!.iid } : { kind: 'player', player: foe });
  const bad = validateTarget(g, iid, player, t);
  if (bad) return bad;
  strike(g, player, iid, t);
  return null;
}

export { cycleActive };
