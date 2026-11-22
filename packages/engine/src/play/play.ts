import type { ApplyResult, PlayerId, RuleError, SlotKind, Target } from '../types.ts';
import { cardOf, inst, passives, type G } from '../ctx.ts';
import { emit, entryEffects, settle } from '../effects/triggers.ts';

const err = (code: RuleError['code'], params?: RuleError['params']): ApplyResult => ({ ok: false, error: params ? { code, params } : { code } });

function slotKindFor(category: string): SlotKind | 'resolved' {
  switch (category) {
    case 'character':
      return 'characters';
    case 'terrain':
      return 'terrains';
    case 'equipment':
      return 'spells';
    default:
      return 'resolved'; // instant spell: resolved then sent to the graveyard
  }
}

export { entryEffects };

export function playCard(g: G, player: PlayerId, iid: string, slot: number | undefined, targets: Target[], option: number | undefined): ApplyResult {
  const { s: state, ev: events } = g;
  const p = state.players[player];
  const handIdx = p.hand.indexOf(iid);
  if (handIdx < 0) return err('CARD_NOT_IN_HAND');
  const card = cardOf(g, iid);
  const printed = card.cost ?? 0;
  const cost = p.freePlay ? 0 : printed;
  if (cost > p.coins) return err('NOT_ENOUGH_COINS', { cost, coins: p.coins });
  if (card.category === 'terrain' && p.noTerrainUntil >= p.turnNumber) return err('TERRAIN_LOCKED');

  const zone = slotKindFor(card.category);
  let chosen: number | undefined;
  if (zone !== 'resolved') {
    const slots = p[zone];
    if (slot === undefined) {
      chosen = slots.indexOf(null);
      if (chosen < 0) return err('NO_FREE_SLOT', { zone });
    } else {
      if (slot < 0 || slot >= slots.length) return err('WRONG_SLOT', { zone, slot });
      if (slots[slot] !== null) return err('SLOT_OCCUPIED', { zone, slot });
      chosen = slot;
    }
  }

  p.hand.splice(handIdx, 1);
  p.coins -= cost;
  p.bonusCoins = Math.max(0, p.bonusCoins - cost);
  if (p.freePlay) p.freePlay = false;
  const i = inst(g, iid);
  i.owner = player;
  if (zone === 'resolved') {
    events.push({ type: 'cardPlayed', player, iid, cardId: card.id, zone, cost });
  } else {
    p[zone][chosen!] = iid;
    i.playedOnTurn = p.turnNumber;
    i.attacksUsed = 0;
    events.push({ type: 'cardPlayed', player, iid, cardId: card.id, zone, slot: chosen!, cost });
    for (const e of passives(g, iid, 'spellImmuneAfterPlay')) i.statuses.push({ kind: 'spellImmune', turnsLeft: e.turns ?? 2, source: iid });
  }

  if (zone === 'resolved') p.graveyard.push(iid);
  // its own onPlay (or spell effect) and the onAllyPlayed / onEnemyPlayed of the table (story 11.4)
  emit(g, { type: 'played', iid, player, ...(option !== undefined ? { option } : {}), targets });
  settle(g, true);
  return { ok: true, state, events };
}
