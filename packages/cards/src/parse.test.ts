import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CardDataError, parseSet } from './parse.ts';
import { loadSetsFromDir } from './node.ts';

const CONTENT = fileURLToPath(new URL('../../../content/sets', import.meta.url));

describe('card data', () => {
  it('loads the 51 MVP cards with unique ids', () => {
    const { sets, catalog } = loadSetsFromDir(CONTENT);
    expect(sets.map((s) => s.id).sort()).toEqual(['holy-grail', 'hot-shots', 'matrix', 'white-chicks']);
    expect(catalog.size).toBe(51);
  });

  it('accepts multi-body characters (Sentinelles)', () => {
    const { catalog } = loadSetsFromDir(CONTENT);
    expect(catalog.get('mx-sentinels')?.hp).toEqual([100, 100, 100]);
  });

  it('names the file, card and field of an invalid card', () => {
    const bad = { id: 'x', title: 'X', year: 2000, family: 'X', cards: [{ id: 'xx-bad', set: 'x', name: 'Bad', rarity: 'mythic', category: 'character', role: 'guerrier', cost: 1, hp: 10, atk: 10, abilities: [], image: null }] };
    try {
      parseSet(bad, 'bad.json');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CardDataError);
      const err = e as CardDataError;
      expect(err.file).toBe('bad.json');
      expect(err.issues[0]).toMatchObject({ card: 'xx-bad', path: 'rarity' });
    }
  });
});
