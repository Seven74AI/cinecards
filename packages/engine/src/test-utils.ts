import type { Card } from '@cinecards/cards';
import type { Catalog, GameState, PlayerId } from './types.ts';
import { createGame } from './state/create.ts';

export function char(id: string, cost: number, hp: number | number[], atk: number | number[], extra: Partial<Card> = {}): Card {
  return { id, set: 'test', name: id, rarity: 'common', category: 'character', role: 'guerrier', cost, hp, atk, abilities: [], image: null, ...extra } as Card;
}
export function spell(id: string, cost: number, category: Card['category'] = 'spell'): Card {
  return { id, set: 'test', name: id, rarity: category === 'terrain' ? 'terrain' : 'spell', category, role: category, cost, hp: null, atk: null, abilities: [], image: null } as Card;
}
export function catalogOf(cards: Card[]): Catalog {
  return new Map(cards.map((c) => [c.id, c]));
}

/** A started game where we then hand-place cards for precise scenarios. */
export function setup(cards: Card[], seed = 1): { catalog: Catalog; state: GameState } {
  const catalog = catalogOf(cards);
  const { state } = createGame(catalog, { seed, autoStart: false });
  state.active = 0;
  state.players[0].turnNumber = 1;
  state.players[1].turnNumber = 1;
  return { catalog, state };
}

/** Moves the instance of `cardId` into a zone for a player. */
export function put(state: GameState, cardId: string, player: PlayerId, zone: 'hand' | 'characters', slot = 0, playedOnTurn = 0): string {
  const iid = Object.values(state.instances).find((i) => i.cardId === cardId)!.iid;
  state.sharedDeck = state.sharedDeck.filter((x) => x !== iid);
  const inst = state.instances[iid]!;
  inst.owner = player;
  if (zone === 'hand') state.players[player].hand.push(iid);
  else {
    state.players[player].characters[slot] = iid;
    inst.playedOnTurn = playedOnTurn;
  }
  return iid;
}
