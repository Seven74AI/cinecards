import { describe, expect, it } from 'vitest';
import type { Ability, Card } from '@cinecards/cards';
import { apply, createGame, playableCardIds, type Action, type Catalog, type GameState, type PlayerId } from './index.ts';
import { catalogOf, char } from './test-utils.ts';
import { MVP } from './scenario.ts';

/** Story 10.1: constructed mode, one validated 50-card deck per player. */
const power = { icon: 'bolt' as const, count: 1 };
const ab = (kind: string, effects: Ability['effects']): Ability => ({ name: `${kind}!`, power, kind, text: kind, effects }) as Ability;

const playable = playableCardIds(MVP).sort();
const deckA = playable.slice(0, 50);
const deckB = playable.slice(-50); // overlaps deckA: both players may hold the same card

function ok(catalog: Catalog, state: GameState, action: Action) {
  const r = apply(catalog, state, action);
  if (!r.ok) throw new Error(`unexpected ${r.error.code}`);
  return r;
}

const idsOf = (state: GameState, iids: string[]) => iids.map((iid) => state.instances[iid]!.cardId);

/** A small catalog of 55 vanilla characters plus a thief that draws 3 cards from the opponent's deck. */
function thiefCatalog(): Catalog {
  const cards: Card[] = Array.from({ length: 55 }, (_, i) => char(`v${String(i).padStart(2, '0')}`, 1, 100, 10));
  cards.push(char('thief', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'draw', count: 3, who: 'opponentPile' }])] }));
  return catalogOf(cards);
}

describe('10.1 constructed mode', () => {
  it('builds one shuffled pile per player from their own deck, owned by them', () => {
    const { state, events } = createGame(MVP, { seed: 3, mode: 'constructed', decks: [deckA, deckB] });
    expect(events[0]).toMatchObject({ type: 'gameStarted', mode: 'constructed' });
    expect(state.sharedDeck).toEqual([]);
    for (const p of [0, 1] as PlayerId[]) {
      const own = [...state.players[p].deck, ...state.players[p].hand];
      expect(own).toHaveLength(50);
      expect(idsOf(state, own).sort()).toEqual((p === 0 ? deckA : deckB).slice().sort());
      expect(own.every((iid) => state.instances[iid]!.owner === p)).toBe(true);
    }
    const f = state.firstPlayer;
    expect(state.players[f].deck).toHaveLength(50 - 8);
    expect(state.players[1 - f]!.deck).toHaveLength(50 - 7);
    // the same card can be in both decks: one instance each
    const shared = deckA.find((id) => deckB.includes(id))!;
    expect(Object.values(state.instances).filter((i) => i.cardId === shared)).toHaveLength(2);
    // shuffled, and deterministic for a seed
    expect(idsOf(state, state.players[0].deck)).not.toEqual(deckA.slice(0, state.players[0].deck.length));
    expect(createGame(MVP, { seed: 3, mode: 'constructed', decks: [deckA, deckB] }).state).toEqual(state);
  });

  it('draws from its own pile and reshuffles only its own graveyard', () => {
    const { state } = createGame(MVP, { seed: 4, mode: 'constructed', decks: [deckA, deckB], autoStart: false });
    state.active = 1;
    state.players[0].turnNumber = 1;
    state.players[1].turnNumber = 1;
    const top = state.players[0].deck[0]!;
    let r = ok(MVP, state, { type: 'endTurn', player: 1 });
    expect(r.state.players[0].hand).toEqual([top]);
    expect(r.state.players[1].deck).toHaveLength(50);

    // empty pile: refilled from the owner's graveyard only
    const s = r.state;
    const mine = s.players[0].deck.splice(0, 3);
    s.players[0].graveyard = mine;
    s.players[0].deck = [];
    const theirs = s.players[1].deck.splice(0, 2);
    s.players[1].graveyard = theirs;
    r = ok(MVP, s, { type: 'endTurn', player: 0 });
    r = ok(MVP, r.state, { type: 'endTurn', player: 1 });
    expect(r.events).toContainEqual({ type: 'deckReshuffled', player: 0, size: 3 });
    expect(r.state.players[1].graveyard).toEqual(theirs);
    expect(r.state.players[0].hand.filter((iid) => mine.includes(iid))).toHaveLength(1);
    expect(r.state.players[0].deck).toHaveLength(2);
  });

  it('"deck ADVERSE" draws from the opponent\'s pile', () => {
    const catalog = thiefCatalog();
    const ids = [...catalog.keys()].sort();
    const mine = ['thief', ...ids.filter((id) => id !== 'thief').slice(0, 49)];
    const theirs = ids.filter((id) => id !== 'thief').slice(-50);
    const { state } = createGame(catalog, { seed: 9, mode: 'constructed', decks: [mine, theirs], autoStart: false });
    state.active = 0;
    state.players[0].turnNumber = 1;
    state.players[1].turnNumber = 1;
    const thief = state.players[0].deck.find((iid) => state.instances[iid]!.cardId === 'thief')!;
    state.players[0].deck = state.players[0].deck.filter((iid) => iid !== thief);
    state.players[0].hand = [thief];
    state.players[0].coins = 5;
    const top3 = state.players[1].deck.slice(0, 3);
    const ownBefore = state.players[0].deck.length;
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: thief });
    expect(r.state.players[0].hand).toEqual(top3);
    expect(r.state.players[1].deck).toHaveLength(50 - 3);
    expect(r.state.players[0].deck).toHaveLength(ownBefore);
    expect(top3.every((iid) => r.state.instances[iid]!.owner === 0)).toBe(true);
  });

  it('refuses invalid decks with a clear error', () => {
    const create = (decks: [string[], string[]]) => () => createGame(MVP, { seed: 1, mode: 'constructed', decks });
    expect(create([deckA.slice(1), deckB])).toThrow('invalid deck for player 0: size');
    expect(create([deckA, [...deckB.slice(1), deckB[2]!]])).toThrow('invalid deck for player 1: duplicate');
    expect(create([deckA, [...deckB.slice(1), 'zz-nope']])).toThrow('invalid deck for player 1: unknown');
    expect(create([[...deckA.slice(3), deckA[3]!, 'zz-nope'], deckB])).toThrow('invalid deck for player 0: size, duplicate, unknown');
    expect(() => createGame(MVP, { seed: 1, mode: 'constructed' })).toThrow('constructed mode needs one deck per player');
    // a card the engine cannot play yet
    const catalog = thiefCatalog();
    const broken = new Map(catalog);
    broken.set('v00', char('v00', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'unsupported' }] as never)] }));
    const deck = [...catalog.keys()].sort().slice(0, 50);
    expect(() => createGame(broken, { seed: 1, mode: 'constructed', decks: [deck, deck] })).toThrow('invalid deck for player 0: unplayable');
  });

  it('leaves the shared and randomSplit modes unchanged', () => {
    expect(createGame(MVP, { seed: 5 }).state.sharedDeck).toHaveLength(playable.length - 15);
    const split = createGame(MVP, { seed: 5, mode: 'randomSplit' }).state;
    expect(split.players[0].deck.length + split.players[1].deck.length + 15).toBe(2 * Math.floor(playable.length / 2));
  });
});
