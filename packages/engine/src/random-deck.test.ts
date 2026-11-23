import { validateDeck } from '@cinecards/cards/deck';
import { describe, expect, it } from 'vitest';
import { createGame, playableCardIds, randomDeck } from './index.ts';
import { MVP } from './scenario.ts';

describe('randomDeck (story 10.3)', () => {
  const playable = playableCardIds(MVP);

  it('draws 50 distinct playable cards that make a valid deck', () => {
    const deck = randomDeck(playable, 42);
    expect(deck).toHaveLength(50);
    expect(new Set(deck).size).toBe(50);
    expect(deck.every((id) => playable.includes(id))).toBe(true);
    expect(validateDeck(deck, MVP, playable).ok).toBe(true);
  });

  it('is deterministic for a seed, whatever the order of the playable list', () => {
    expect(randomDeck(playable, 7)).toEqual(randomDeck([...playable].reverse(), 7));
    const seeds = [1, 2, 3, 4, 5].map((s) => randomDeck(playable, s).join());
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('gives every playable card when there are fewer than 50', () => {
    expect(randomDeck(['b', 'a', 'a'], 3).sort()).toEqual(['a', 'b']);
  });

  it('starts a constructed game against a seeded deck', () => {
    const { state } = createGame(MVP, { seed: 9, mode: 'constructed', decks: [randomDeck(playable, 1), randomDeck(playable, 9)] });
    expect(state.mode).toBe('constructed');
  });
});
