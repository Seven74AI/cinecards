import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DECK_SIZE, validateDeck, type DeckValidation } from './deck.ts';
import { loadSetsFromDir } from './node.ts';

const { catalog } = loadSetsFromDir(fileURLToPath(new URL('../../../content/sets', import.meta.url)));
const all = [...catalog.keys()].sort();
const deck = all.slice(0, DECK_SIZE);
const errors = (v: DeckValidation) => (v.ok ? [] : v.errors);

describe('10.1 deck rules', () => {
  it('accepts 50 distinct playable cards', () => {
    expect(DECK_SIZE).toBe(50);
    expect(validateDeck(deck, catalog, all)).toEqual({ ok: true });
  });

  it('refuses 49 or 51 cards with a French message', () => {
    expect(errors(validateDeck(deck.slice(1), catalog, all))).toEqual([{ code: 'size', message: 'Il manque 1 carte (50 exactement).' }]);
    expect(errors(validateDeck(deck.slice(3), catalog, all))[0]!.message).toBe('Il manque 3 cartes (50 exactement).');
    expect(errors(validateDeck([...deck, all[DECK_SIZE]!], catalog, all))).toEqual([{ code: 'size', message: '1 carte de trop (50 exactement).' }]);
  });

  it('refuses a duplicate (one error per doubled card)', () => {
    const id = deck[0]!;
    const v = validateDeck([...deck.slice(0, 49), id], catalog, all);
    expect(errors(v)).toEqual([{ code: 'duplicate', cardId: id, message: `« ${catalog.get(id)!.name} » est en double : une seule copie par carte.` }]);
    expect(errors(validateDeck([...deck.slice(0, 47), id, id, id], catalog, all))).toHaveLength(1);
  });

  it('refuses an unknown card', () => {
    expect(errors(validateDeck([...deck.slice(0, 49), 'zz-nope'], catalog, all))).toEqual([{ code: 'unknown', cardId: 'zz-nope', message: 'Carte inconnue : zz-nope.' }]);
  });

  it('refuses a card the engine cannot play yet', () => {
    const id = deck[5]!;
    const v = validateDeck(deck, catalog, all.filter((x) => x !== id));
    expect(errors(v)).toEqual([{ code: 'unplayable', cardId: id, message: `« ${catalog.get(id)!.name} » n'est pas encore jouable.` }]);
  });

  it('lists several errors at once, sorted: size, duplicates, unknown, unplayable', () => {
    const [a, b] = [deck[0]!, deck[1]!];
    const v = validateDeck([b, 'zz-nope', a, a], catalog, all.filter((x) => x !== b));
    expect(errors(v).map((e) => e.code)).toEqual(['size', 'duplicate', 'unknown', 'unplayable']);
    expect(errors(v)[0]!.message).toBe('Il manque 46 cartes (50 exactement).');
  });
});
