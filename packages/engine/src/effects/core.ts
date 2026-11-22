import { RULES } from '../rules.ts';
import { roundDamage } from '../state/compute-stats.ts';
import type { PlayerId } from '../types.ts';
import { board, cardOf, characters, cycleActive, hasStatus, inst, onBoard, passives, stats, type G } from '../ctx.ts';
import { emit } from './triggers.ts';

/** Clears a card's in-play state when it leaves the table. */
export function resetInstance(g: G, iid: string): void {
  const i = inst(g, iid);
  Object.assign(i, { damage: 0, modifiers: [], statuses: [], usedAbilities: [], playedOnTurn: 0, attacksUsed: 0, attackCount: 0, survivals: 0, abilityTurns: {} });
  delete i.reactedOn;
  if (i.bodyDamage) i.bodyDamage = i.bodyDamage.map(() => 0);
}

export function removeFromBoard(g: G, iid: string): PlayerId | null {
  const where = onBoard(g, iid);
  if (!where) return null;
  g.s.players[where.player][where.kind][where.slot] = null;
  return where.player;
}

export function toGraveyard(g: G, iid: string): void {
  removeFromBoard(g, iid);
  const owner = inst(g, iid).owner;
  resetInstance(g, iid);
  g.s.players[owner].graveyard.push(iid);
}

export function toHand(g: G, iid: string, player = inst(g, iid).owner): void {
  removeFromBoard(g, iid);
  for (const p of g.s.players) {
    p.hand = p.hand.filter((x) => x !== iid);
    p.graveyard = p.graveyard.filter((x) => x !== iid);
  }
  resetInstance(g, iid);
  const i = inst(g, iid);
  i.owner = player;
  const hand = g.s.players[player].hand;
  if (hand.length >= RULES.MAX_HAND) g.s.players[player].graveyard.push(iid);
  else hand.push(iid);
  g.ev.push({ type: 'returnedToHand', iid, owner: player });
}

export interface DamageOpts {
  source: string | null;
  fromAttack: boolean;
  sourcePlayer: PlayerId;
}

/** Full damage pipeline (GDD order): insensible → attacker multipliers → lethal → reductions → rounding → shield → hp. */
export function damage(g: G, target: string, raw: number, opts: DamageOpts): number {
  const t = inst(g, target);
  const insensible =
    t.owner !== opts.sourcePlayer &&
    (hasStatus(g, target, 'insensible') || passives(g, target, 'cycleInsensible').some((e) => cycleActive(g, target, e.every ?? 2)));
  if (insensible) {
    g.ev.push({ type: 'damageDealt', source: opts.source ?? 'rule', target, amount: 0, absorbed: 0 });
    return 0;
  }
  let amount = raw;
  if (opts.fromAttack && opts.source) {
    for (const e of passives(g, opts.source, 'cycleAttackMultiplier')) if (cycleActive(g, opts.source, e.every ?? 2)) amount *= e.multiplier ?? 2;
    const lethal = passives(g, opts.source, 'cycleLethal').some((e) => cycleActive(g, opts.source!, e.every ?? 2));
    if (lethal) amount = Math.max(amount, stats(g, target).hp + 1000);
  }
  const where = onBoard(g, target);
  if (where) {
    for (const src of board(g)) {
      for (const e of passives(g, src.iid, 'damageTaken')) {
        const who = e.who ?? 'allies';
        const sameSide = src.player === where.player;
        if ((who === 'allies' && !sameSide) || (who === 'enemies' && sameSide)) continue;
        if (e.filter?.set && cardOf(g, target).set !== e.filter.set) continue;
        amount *= e.multiplier ?? 1;
      }
    }
  }
  amount = roundDamage(amount);
  let absorbed = 0;
  for (const st of t.statuses) {
    if (st.kind === 'shield' && (st.amount ?? 0) > 0 && amount > 0) {
      const used = Math.min(st.amount!, amount);
      st.amount! -= used;
      amount -= used;
      absorbed += used;
    }
  }
  t.statuses = t.statuses.filter((s) => s.kind !== 'shield' || (s.amount ?? 0) > 0);
  if (t.bodyDamage) {
    const idx = stats(g, target).bodies!.findIndex((b) => b.alive);
    if (idx >= 0) t.bodyDamage[idx] = (t.bodyDamage[idx] ?? 0) + amount;
  } else {
    t.damage += amount;
  }
  g.ev.push({ type: 'damageDealt', source: opts.source ?? 'rule', target, amount, absorbed });
  return amount;
}

export function heal(g: G, target: string, amount: number): void {
  const t = inst(g, target);
  if (t.bodyDamage) t.bodyDamage = t.bodyDamage.map((d) => Math.max(0, d - amount));
  else t.damage = Math.max(0, t.damage - amount);
  g.ev.push({ type: 'healed', target, amount });
}

/** Sets a character back to `hp` remaining hit points. */
function setRemainingHp(g: G, iid: string, hp: number): void {
  const t = inst(g, iid);
  const st = stats(g, iid);
  if (t.bodyDamage && st.bodies) {
    const idx = st.bodies.length - 1;
    t.bodyDamage = t.bodyDamage.map((d, i) => (i === idx ? Math.max(0, st.bodies![i]!.hp + d - hp) : d));
  } else {
    t.damage = Math.max(0, st.maxHp - hp);
  }
}

/** Tries death-prevention passives and automatic reactions; returns true if the card survives. */
function preventDeath(g: G, iid: string): boolean {
  const i = inst(g, iid);
  for (const e of passives(g, iid, 'surviveDeath')) {
    if ((i.survivals ?? 0) < (e.times ?? 1)) {
      i.survivals = (i.survivals ?? 0) + 1;
      setRemainingHp(g, iid, e.hp ?? 10);
      if (e.atkLoss) i.modifiers.push({ source: iid, label: e._ability.name, atk: -e.atkLoss, hp: 0 });
      g.ev.push({ type: 'deathPrevented', iid, label: e._ability.name });
      return true;
    }
  }
  // automatic reactions of allies: cancelDeath (stays at 10 hp) / returnOnDeath (back to hand)
  for (const ally of board(g).filter((b) => b.player === i.owner)) {
    if (hasStatus(g, ally.iid, 'silence')) continue;
    const card = cardOf(g, ally.iid);
    for (const [index, ab] of card.abilities.entries()) {
      if (ab.kind !== 'reaction') continue;
      for (const e of (ab.effects ?? []) as { op: string; hp?: number; oncePerGame?: boolean }[]) {
        if (e.op !== 'cancelDeath' && e.op !== 'returnOnDeath') continue;
        const ally2 = inst(g, ally.iid);
        const key = `${ally.iid}:${index}`;
        if (e.oncePerGame ? g.s.players[i.owner].usedOncePerGame.includes(key) : ally2.usedAbilities.includes(index)) continue;
        if (e.oncePerGame) g.s.players[i.owner].usedOncePerGame.push(key);
        else ally2.usedAbilities.push(index);
        g.ev.push({ type: 'abilityUsed', iid: ally.iid, ability: index, name: ab.name, player: i.owner, trigger: 'reaction' });
        if (e.op === 'cancelDeath') {
          setRemainingHp(g, iid, e.hp ?? 10);
          g.ev.push({ type: 'deathPrevented', iid, label: ab.name });
        } else {
          toHand(g, iid);
        }
        return true;
      }
    }
  }
  return false;
}

/** Destroys a board card (no prevention); its onDeath abilities are queued (story 11.4). */
export function destroy(g: G, iid: string): void {
  const where = onBoard(g, iid);
  if (!where) return;
  const owner = inst(g, iid).owner;
  const silenced = hasStatus(g, iid, 'silence');
  toGraveyard(g, iid);
  g.ev.push({ type: 'cardDestroyed', iid, owner });
  if (!silenced) emit(g, { type: 'died', iid, owner });
}

/** Sends every character at 0 hp to the graveyard, unless something prevents it. Repeats until stable. */
export function processDeaths(g: G): string[] {
  const dead: string[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const zero = characters(g).filter((b) => stats(g, b.iid).hp <= 0).map((b) => b.iid);
    if (zero.length === 0) break;
    for (const iid of zero) {
      if (!onBoard(g, iid)) continue;
      if (preventDeath(g, iid)) continue;
      destroy(g, iid);
      dead.push(iid);
    }
  }
  return dead;
}

export function checkWinner(g: G): void {
  if (g.s.phase === 'finished') return;
  const dead = g.s.players.map((p) => p.hp <= 0);
  if (!dead[0] && !dead[1]) return;
  g.s.phase = 'finished';
  g.s.pending = null;
  g.s.winner = dead[0] && dead[1] ? 'draw' : dead[0] ? 1 : 0;
  g.ev.push({ type: 'gameOver', winner: g.s.winner });
}

export function damagePlayer(g: G, player: PlayerId, amount: number): void {
  const p = g.s.players[player];
  const dmg = roundDamage(amount);
  p.hp = Math.max(0, p.hp - dmg);
  g.ev.push({ type: 'playerDamaged', player, amount: dmg, hp: p.hp });
}
