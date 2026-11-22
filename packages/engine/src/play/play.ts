import type { Ability } from '@cinecards/cards';
import type { ApplyResult, PlayerId, RuleError, SlotKind, Target } from '../types.ts';
import { cardOf, inst, passives, type Eff, type G } from '../ctx.ts';
import { checkWinner, processDeaths } from '../effects/core.ts';
import { runEffects } from '../effects/run.ts';
import { offerReaction } from './reactions.ts';

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

/** Effects to run when a card enters play: onPlay abilities, plus active/choice abilities of spells & equipment. */
export function entryEffects(abilities: Ability[], category: string, option: number | undefined): { ability: Ability; index: number; effects: Eff[] }[] {
  const out: { ability: Ability; index: number; effects: Eff[] }[] = [];
  const isSpell = category === 'spell' || category === 'equipment';
  const choices = abilities.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'choice');
  abilities.forEach((ability, index) => {
    if (ability.kind === 'onPlay' || (isSpell && ability.kind === 'active')) out.push({ ability, index, effects: (ability.effects ?? []) as Eff[] });
  });
  if (isSpell && choices.length > 0) {
    const chosen = choices[Math.min(option ?? 0, choices.length - 1)]!;
    out.push({ ability: chosen.a, index: chosen.i, effects: (chosen.a.effects ?? []) as Eff[] });
  }
  return out;
}

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

  const isSpell = card.category === 'spell' || card.category === 'equipment';
  for (const { ability, index, effects } of entryEffects(card.abilities, card.category, option)) {
    events.push({ type: 'abilityUsed', iid, ability: index, name: ability.name, player });
    runEffects(g, effects, { source: iid, player, targets: [...targets], fromSpell: isSpell, label: ability.name });
  }
  if (zone === 'resolved' && !p.graveyard.includes(iid)) p.graveyard.push(iid);
  processDeaths(g);
  checkWinner(g);
  offerReaction(g, player);
  return { ok: true, state, events };
}
