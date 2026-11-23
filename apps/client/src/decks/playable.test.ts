import { describe, expect, it } from 'vitest';
import type { SavedDeck } from '../account/api.ts';
import { CATALOG, PLAYABLE } from '../game/catalog.ts';
import { defaultDeck, playableDecks } from './playable.ts';

const deck = (id: number, name: string, cards: string[], valid = true): SavedDeck => ({ id, name, cards, valid, errors: [], updatedAt: 0 });
const full = [...PLAYABLE].slice(0, 50);

describe('playable decks (story 10.3)', () => {
  it('keeps only valid decks, checked with this client’s cards too, sorted by name', () => {
    const list = [deck(1, 'Zorro', full), deck(2, 'Incomplet', full.slice(0, 10), false), deck(3, 'Alpha', full), deck(4, 'Faux valide', full.slice(0, 49), true)];
    expect(playableDecks(list, CATALOG, PLAYABLE).map((d) => d.id)).toEqual([3, 1]);
  });

  it('preselects the last deck chosen when it is still there, else the first', () => {
    const list = [deck(3, 'Alpha', full), deck(1, 'Zorro', full)];
    expect(defaultDeck(list, 1)?.id).toBe(1);
    expect(defaultDeck(list, 9)?.id).toBe(3);
    expect(defaultDeck(list, null)?.id).toBe(3);
    expect(defaultDeck([], 1)).toBeNull();
  });
});
