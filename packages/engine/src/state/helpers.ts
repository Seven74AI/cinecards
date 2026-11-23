import type { Card } from '@cinecards/cards';
import { RULES } from '../rules.ts';
import type { Catalog, CardInstance, DeckMode, GameState, PlayerId, PlayerState, SlotKind } from '../types.ts';

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/** True when each player draws from their own pile (randomSplit and constructed modes). */
export const ownPiles = (mode: DeckMode): boolean => mode !== 'shared';

export function cardOf(catalog: Catalog, state: GameState, iid: string): Card {
  const inst = state.instances[iid];
  if (!inst) throw new Error(`unknown instance ${iid}`);
  const card = catalog.get(inst.cardId);
  if (!card) throw new Error(`unknown card ${inst.cardId}`);
  return card;
}

export function newInstance(state: GameState, cardId: string, owner: PlayerId, card: Card): CardInstance {
  const iid = `c${state.nextIid++}`;
  const inst: CardInstance = { iid, cardId, owner, damage: 0, modifiers: [], statuses: [], usedAbilities: [], playedOnTurn: 0, attacksUsed: 0 };
  if (Array.isArray(card.hp)) inst.bodyDamage = card.hp.map(() => 0);
  state.instances[iid] = inst;
  return inst;
}

export function emptyPlayer(): PlayerState {
  return {
    hp: RULES.PLAYER_HP,
    coins: 0,
    coinCap: RULES.COIN_CAP,
    turnNumber: 0,
    hand: [],
    graveyard: [],
    deck: [],
    characters: Array<string | null>(RULES.CHARACTER_SLOTS).fill(null),
    terrains: Array<string | null>(RULES.TERRAIN_SLOTS).fill(null),
    spells: Array<string | null>(RULES.SPELL_SLOTS).fill(null),
    bonusCoins: 0,
    freePlay: false,
    noTerrainUntil: 0,
    usedOncePerGame: [],
  };
}

export const SLOT_KINDS: SlotKind[] = ['characters', 'terrains', 'spells'];

/** Where a card instance sits on the table, if anywhere. */
export function locate(state: GameState, iid: string): { player: PlayerId; kind: SlotKind; slot: number } | null {
  for (const player of [0, 1] as PlayerId[]) {
    for (const kind of SLOT_KINDS) {
      const slot = state.players[player][kind].indexOf(iid);
      if (slot >= 0) return { player, kind, slot };
    }
  }
  return null;
}

export function charactersOf(state: GameState, player: PlayerId): string[] {
  return state.players[player].characters.filter((x): x is string => x !== null);
}
