import { RULES } from '../rules.ts';
import { shuffleInPlace } from '../rng.ts';
import type { CardInstance, GameEvent, GameState, PlayerId } from '../types.ts';
import { other, ownPiles } from '../state/helpers.ts';
import { board, coinCap, cycleActive, inst, passives, stats, type G } from '../ctx.ts';
import { checkWinner, damage, processDeaths } from '../effects/core.ts';
import { runEffects } from '../effects/run.ts';
import { drain, emit } from '../effects/triggers.ts';

/** The pile a player draws from, depending on the deck mode. */
export function pileOf(state: GameState, player: PlayerId): string[] {
  return ownPiles(state.mode) ? state.players[player].deck : state.sharedDeck;
}

/** Refills an empty pile from graveyards (both in shared mode, the owner's with own piles). */
function refill(state: GameState, player: PlayerId, events: GameEvent[]): boolean {
  const pile = pileOf(state, player);
  const sources: PlayerId[] = ownPiles(state.mode) ? [player] : [0, 1];
  const cards = sources.flatMap((p) => state.players[p].graveyard.splice(0));
  if (cards.length === 0) return false;
  for (const iid of cards) {
    const inst = state.instances[iid]!;
    Object.assign(inst, { damage: 0, modifiers: [], statuses: [], usedAbilities: [], playedOnTurn: 0, attacksUsed: 0 });
    if (inst.bodyDamage) inst.bodyDamage = inst.bodyDamage.map(() => 0);
  }
  pile.push(...shuffleInPlace(state, cards));
  events.push({ type: 'deckReshuffled', player: ownPiles(state.mode) ? player : 'shared', size: pile.length });
  return true;
}

export function drawCard(state: GameState, player: PlayerId, events: GameEvent[]): void {
  let pile = pileOf(state, player);
  if (pile.length === 0 && !refill(state, player, events)) {
    events.push({ type: 'deckEmpty', player });
    return;
  }
  pile = pileOf(state, player);
  const iid = pile.shift()!;
  const p = state.players[player];
  state.instances[iid]!.owner = player;
  if (p.hand.length >= RULES.MAX_HAND) {
    p.graveyard.push(iid);
    events.push({ type: 'cardBurned', player, iid });
    return;
  }
  p.hand.push(iid);
  events.push({ type: 'cardDrawn', player, iid });
}

/** Start of a player's turn: counter, income, poison, start-of-turn passives, draw, attack reset. */
export function startTurn(g: G, player: PlayerId): void {
  const { s: state, ev: events } = g;
  state.active = player;
  const p = state.players[player];
  p.turnNumber += 1;
  events.push({ type: 'turnStarted', player, turnNumber: p.turnNumber });

  const income = Math.min(p.turnNumber, RULES.INCOME_CAP);
  const before = p.coins;
  p.coins = Math.max(p.coins, Math.min(p.coins + income, coinCap(g, player)));
  events.push({ type: 'coinsGained', player, amount: p.coins - before, total: p.coins });

  for (const iid of p.characters) if (iid) state.instances[iid]!.attacksUsed = 0;

  // poison ticks, then start-of-turn passives of this player's cards
  for (const iid of p.characters) {
    if (!iid) continue;
    for (const st of state.instances[iid]!.statuses) if (st.kind === 'poison') damage(g, iid, st.amount ?? 20, { source: st.source, fromAttack: false, sourcePlayer: other(player) });
  }
  for (const b of board(g).filter((x) => x.player === player)) doubleAtkOnCycle(g, b.iid);
  for (const b of board(g).filter((x) => x.player === player)) {
    for (const e of passives(g, b.iid, 'startOfTurn')) {
      runEffects(g, e.effects ?? [], { source: b.iid, player, targets: [], fromSpell: false, label: e._ability.name });
    }
  }
  processDeaths(g);
  checkWinner(g);
  if (state.phase === 'finished') return;
  drawCard(state, player, events);
  // start-of-turn triggers (story 11.4): queued, resolved by drain()
  emit(g, { type: 'turnStarted', player });
}

/**
 * "Every N turns, ATK doubles" (story 13.4, Néo): on an active cycle turn the card gains a permanent
 * modifier equal to its current ATK, so the bonus stacks (160 → 320 → 640…). Silenced: no doubling;
 * the modifiers are lost with the card when it leaves play.
 */
function doubleAtkOnCycle(g: G, iid: string): void {
  for (const e of passives(g, iid, 'cycleAtkDouble')) {
    if (!cycleActive(g, iid, e.every ?? 2)) continue;
    const gain = stats(g, iid).atk;
    if (gain <= 0) continue;
    const label = e._ability.name;
    g.ev.push({ type: 'abilityUsed', iid, ability: e._index, name: label, player: inst(g, iid).owner, trigger: 'startOfTurn' });
    inst(g, iid).modifiers.push({ source: iid, label, atk: gain, hp: 0 });
    g.ev.push({ type: 'modified', target: iid, atk: gain, hp: 0, label });
  }
}

/** The active player ends the turn: end-of-turn triggers resolve first, then the turn passes (story 11.4). */
export function endTurn(g: G): void {
  emit(g, { type: 'turnEnding', player: g.s.active });
  g.s.endingTurn = true;
  drain(g);
}

/** Expires this player's timed statuses/modifiers, drops unused bonus coins, passes the turn. */
export function finishEndTurn(g: G): void {
  const { s: state, ev: events } = g;
  const player = state.active;
  for (const b of board(g).filter((x) => x.player === player)) tickTimers(state.instances[b.iid]!);
  // the opponent's timed effects applied to my cards also count down on my turn end
  const p = state.players[player];
  p.coins = Math.min(Math.max(0, p.coins - p.bonusCoins), coinCap(g, player));
  p.bonusCoins = 0;
  p.freePlay = false;
  events.push({ type: 'turnEnded', player });
  startTurn(g, other(player));
}

function tickTimers(i: CardInstance): void {
  i.statuses = i.statuses.flatMap((st) => (st.turnsLeft === undefined ? [st] : st.turnsLeft - 1 > 0 ? [{ ...st, turnsLeft: st.turnsLeft - 1 }] : []));
  i.modifiers = i.modifiers.flatMap((m) => (m.turnsLeft === undefined ? [m] : m.turnsLeft - 1 > 0 ? [{ ...m, turnsLeft: m.turnsLeft - 1 }] : []));
}
