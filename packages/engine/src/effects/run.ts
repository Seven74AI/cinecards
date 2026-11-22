import { RULES } from '../rules.ts';
import { randomInt, rollD6 } from '../rng.ts';
import { roundDamage } from '../state/compute-stats.ts';
import type { PlayerId, Status } from '../types.ts';
import { board, cardOf, characters, coinCap, immuneTo, inst, onBoard, stats, type Eff, type G } from '../ctx.ts';
import { drawCard, pileOf } from '../turn/turn.ts';
import { damage, destroy, heal, processDeaths, removeFromBoard, toHand } from './core.ts';
import { findSummon, resolveTargets, type EffectCtx } from './targets.ts';

const NEGATIVE: Status['kind'][] = ['silence', 'poison', 'stunned'];
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/** Executes a list of effects in order (story 3.1), honouring the 50-effect chain cap. */
export function runEffects(g: G, effects: Eff[], ctx: EffectCtx): void {
  for (const e of effects) {
    if (g.chainStopped || g.s.phase === 'finished' || g.s.pending?.kind === 'pick') return;
    g.chain += 1;
    if (g.chain > RULES.CHAIN_LIMIT) {
      g.chainStopped = true;
      g.ev.push({ type: 'chainLimitReached' });
      return;
    }
    runOne(g, e, ctx);
  }
}

function runOne(g: G, e: Eff, ctx: EffectCtx): void {
  const label = ctx.label;
  switch (e.op) {
    case 'none':
    case 'cooldown':
    case 'oncePerGame':
      return; // markers read by the ability rules

    case 'chooseOne': {
      const opts = e.options as Eff[][];
      runEffects(g, opts[Math.min(ctx.option ?? 0, opts.length - 1)] ?? [], ctx);
      return;
    }

    case 'modify': {
      for (const t of resolveTargets(g, e, ctx)) {
        const m = { source: ctx.source, label, atk: e.atk ?? 0, hp: e.hp ?? 0, ...(e.turns ? { turnsLeft: e.turns } : {}) };
        inst(g, t).modifiers.push(m);
        g.ev.push({ type: 'modified', target: t, atk: m.atk, hp: m.hp, label });
      }
      processDeaths(g);
      return;
    }

    case 'damage': {
      for (const t of resolveTargets(g, e, ctx)) {
        damage(g, t, e.amount, { source: ctx.source, fromAttack: false, sourcePlayer: ctx.player });
        if (e.adjacent) {
          const where = onBoard(g, t);
          if (where) for (const d of [-1, 1]) {
            const n = g.s.players[where.player].characters[where.slot + d];
            if (n) damage(g, n, e.adjacent, { source: ctx.source, fromAttack: false, sourcePlayer: ctx.player });
          }
        }
      }
      processDeaths(g);
      return;
    }

    case 'damageEnemies': {
      // all enemy characters (and nothing else) take `amount`
      for (const b of characters(g, other(ctx.player))) damage(g, b.iid, e.amount, { source: ctx.source, fromAttack: false, sourcePlayer: ctx.player });
      processDeaths(g);
      return;
    }

    case 'heal':
      for (const t of resolveTargets(g, e, ctx)) heal(g, t, e.amount);
      return;

    case 'status':
      for (const t of resolveTargets(g, e, ctx)) {
        const st: Status = { kind: e.status, source: ctx.source, ...(e.amount !== undefined ? { amount: e.amount } : {}), ...(e.turns !== undefined ? { turnsLeft: e.turns } : {}) };
        inst(g, t).statuses.push(st);
        g.ev.push({ type: 'statusApplied', target: t, status: st.kind, ...(e.turns !== undefined ? { turns: e.turns } : {}) });
      }
      return;

    case 'cleanse':
      for (const t of resolveTargets(g, e, ctx)) {
        const i = inst(g, t);
        i.statuses = i.statuses.filter((s) => !NEGATIVE.includes(s.kind));
        i.modifiers = i.modifiers.filter((m) => m.atk >= 0 && m.hp >= 0);
        g.ev.push({ type: 'cleansed', target: t });
      }
      return;

    case 'reset':
      for (const t of resolveTargets(g, e, ctx)) {
        const i = inst(g, t);
        i.statuses = [];
        i.modifiers = [];
        g.ev.push({ type: 'cleansed', target: t });
      }
      processDeaths(g);
      return;

    case 'draw': {
      const who = e.who === 'opponentPile' ? ctx.player : ctx.player;
      const p = g.s.players[who];
      if (e.from === 'graveyard') {
        const limit = Math.min(e.count ?? RULES.MAX_HAND, RULES.MAX_HAND - p.hand.length);
        for (let k = 0; k < limit && p.graveyard.length > 0; k++) {
          const iid = p.graveyard.pop()!;
          p.hand.push(iid);
          g.ev.push({ type: 'cardDrawn', player: who, iid });
        }
        return;
      }
      if (e.who === 'opponentPile' && g.s.mode === 'randomSplit') {
        // "deck ADVERSE": draw from the opponent's pile
        const pile = g.s.players[other(ctx.player)].deck;
        for (let k = 0; k < (e.count ?? 1) && pile.length > 0; k++) {
          const iid = pile.shift()!;
          inst(g, iid).owner = ctx.player;
          if (p.hand.length >= RULES.MAX_HAND) p.graveyard.push(iid);
          else p.hand.push(iid);
          g.ev.push({ type: 'cardDrawn', player: ctx.player, iid });
        }
        return;
      }
      for (let k = 0; k < (e.count ?? 1); k++) drawCard(g.s, ctx.player, g.ev);
      return;
    }

    case 'lookAndPick': {
      const pile = pileOf(g.s, ctx.player);
      const options = pile.slice(0, e.look ?? 3);
      if (options.length === 0) return;
      g.s.pending = { kind: 'pick', player: ctx.player, options, count: Math.min(e.pick ?? 1, options.length), source: ctx.source, label };
      g.ev.push({ type: 'pickOffered', player: ctx.player, count: Math.min(e.pick ?? 1, options.length) });
      return;
    }

    case 'returnToHand':
      for (const t of resolveTargets(g, e, ctx)) {
        if (inst(g, t).owner !== ctx.player && immuneTo(g, t, 'bounce')) continue;
        toHand(g, t);
      }
      return;

    case 'summonFrom': {
      const me = ctx.player;
      const found = findSummon(g, e, me);
      const slot = g.s.players[me].characters.indexOf(null);
      if (!found || slot < 0) {
        if (Array.isArray(e.else)) runEffects(g, e.else, ctx);
        return;
      }
      const from = onBoard(g, found.iid) ? 'enemyBoard' : g.s.players[0].hand.includes(found.iid) || g.s.players[1].hand.includes(found.iid) ? 'hand' : 'graveyard';
      removeFromBoard(g, found.iid);
      for (const p of g.s.players) {
        p.hand = p.hand.filter((x) => x !== found.iid);
        p.graveyard = p.graveyard.filter((x) => x !== found.iid);
      }
      const i = inst(g, found.iid);
      Object.assign(i, { owner: me, damage: 0, statuses: [], usedAbilities: [], attacksUsed: 0, playedOnTurn: g.s.players[me].turnNumber, modifiers: [] });
      if (i.bodyDamage) i.bodyDamage = i.bodyDamage.map(() => 0);
      g.s.players[me].characters[slot] = found.iid;
      if (e.double) {
        const base = stats(g, found.iid);
        i.modifiers.push({ source: ctx.source, label, atk: base.baseAtk, hp: base.baseHp });
      }
      g.ev.push({ type: 'summoned', iid: found.iid, player: me, from });
      return;
    }

    case 'destroyWhere':
      for (const b of board(g)) if ((e.ids as string[]).includes(cardOf(g, b.iid).id)) destroy(g, b.iid);
      return;

    case 'destroy':
      for (const t of resolveTargets(g, e, ctx)) destroy(g, t);
      return;

    case 'dice': {
      const value = rollD6(g.s);
      g.ev.push({ type: 'diceRolled', player: ctx.player, value, label });
      const branch = (e.branches as { min: number; max: number; effects: Eff[] }[]).find((b) => value >= b.min && value <= b.max);
      if (branch) runEffects(g, branch.effects, ctx);
      return;
    }

    case 'copyStats': {
      const src = stats(g, ctx.source);
      for (const t of resolveTargets(g, e, ctx)) {
        const cur = stats(g, t);
        const m = { source: ctx.source, label, atk: src.atk - cur.atk, hp: src.hp - cur.hp };
        inst(g, t).modifiers.push(m);
        g.ev.push({ type: 'modified', target: t, atk: m.atk, hp: m.hp, label });
      }
      processDeaths(g);
      return;
    }

    case 'absorb': {
      const pct = (e.pct ?? 50) / 100;
      let gainAtk = 0;
      let gainHp = 0;
      for (const t of resolveTargets(g, e, ctx)) {
        if (t === ctx.source) continue;
        const cur = stats(g, t);
        const a = roundDamage(cur.atk * pct);
        const h = roundDamage(cur.hp * pct);
        inst(g, t).modifiers.push({ source: ctx.source, label, atk: -a, hp: -h });
        g.ev.push({ type: 'modified', target: t, atk: -a, hp: -h, label });
        gainAtk += a;
        gainHp += h;
      }
      inst(g, ctx.source).modifiers.push({ source: ctx.source, label, atk: gainAtk, hp: gainHp });
      g.ev.push({ type: 'modified', target: ctx.source, atk: gainAtk, hp: gainHp, label });
      processDeaths(g);
      return;
    }

    case 'absorbAllyAtk': {
      let gain = 0;
      for (const b of characters(g, ctx.player)) {
        if (b.iid === ctx.source) continue;
        const a = stats(g, b.iid).atk;
        inst(g, b.iid).modifiers.push({ source: ctx.source, label, atk: -a, hp: 0, turnsLeft: e.turns ?? 1 });
        gain += a;
      }
      inst(g, ctx.source).modifiers.push({ source: ctx.source, label, atk: gain, hp: 0, turnsLeft: e.turns ?? 1 });
      g.ev.push({ type: 'modified', target: ctx.source, atk: gain, hp: 0, label });
      return;
    }

    case 'coinBonus': {
      const p = g.s.players[ctx.player];
      p.coins += e.amount;
      p.bonusCoins += e.amount;
      g.ev.push({ type: 'coinBonus', player: ctx.player, amount: e.amount });
      return;
    }

    case 'discardRandom': {
      const foe = other(ctx.player);
      const hand = g.s.players[foe].hand;
      if (hand.length === 0) return;
      const [iid] = hand.splice(randomInt(g.s, hand.length), 1);
      g.s.players[foe].graveyard.push(iid!);
      g.ev.push({ type: 'cardDiscarded', player: foe, iid: iid! });
      return;
    }

    case 'enemiesHitAdjacent': {
      const foe = other(ctx.player);
      const slots = g.s.players[foe].characters;
      const hits: [string, string, number][] = [];
      slots.forEach((iid, i) => {
        if (!iid) return;
        const atk = stats(g, iid).atk;
        for (const d of [-1, 1]) {
          const n = slots[i + d];
          if (n) hits.push([iid, n, atk]);
        }
      });
      for (const [src, tgt, atk] of hits) if (onBoard(g, tgt)) damage(g, tgt, atk, { source: src, fromAttack: false, sourcePlayer: ctx.player });
      processDeaths(g);
      return;
    }

    case 'playFree':
      g.s.players[ctx.player].freePlay = true;
      return;

    case 'duel': {
      const [mine] = resolveTargets(g, { op: 'pick', target: 'chosenAlly' }, ctx, e);
      const [theirs] = resolveTargets(g, { op: 'pick', target: 'chosenEnemy' }, ctx, e);
      if (!mine || !theirs) return;
      const a = stats(g, mine).atk;
      const b = stats(g, theirs).atk;
      if (a < b) destroy(g, mine);
      else if (b < a) destroy(g, theirs);
      return;
    }

    case 'lockTerrain': {
      const foe = g.s.players[other(ctx.player)];
      foe.noTerrainUntil = foe.turnNumber + 1;
      return;
    }

    case 'extraAttack':
      for (const t of resolveTargets(g, e, ctx)) {
        inst(g, t).statuses.push({ kind: 'extraAttack', amount: e.count ?? 1, turnsLeft: e.turns ?? 1, source: ctx.source });
        g.ev.push({ type: 'statusApplied', target: t, status: 'extraAttack', turns: e.turns ?? 1 });
      }
      return;

    // attack-time ops used inside onAttacked / onAttack passives
    case 'cancelAttack':
      ctx.cancelAttack = true;
      if (ctx.attacker) g.ev.push({ type: 'attackCancelled', attacker: ctx.attacker, label });
      return;
    case 'returnSelf':
      toHand(g, ctx.source);
      return;
    case 'destroyAttacker':
      if (ctx.attacker) destroy(g, ctx.attacker);
      return;

    default:
      throw new Error(`unknown effect op "${e.op}"`);
  }
}

export const capOf = coinCap;
