import { describe, expect, it } from 'vitest';
import type { Card } from '@cinecards/cards';
import { activeCount, copyName, costBand, costCurve, deckFilms, filmList, filterCards, fold, NO_FILTERS, shortError, sortCards, toggle } from './filters.ts';

/** Story 10.2: deck builder filters and sort. */

const card = (id: string, name: string, set: string, cost: number | null, category = 'character', rarity = 'common'): Card =>
  ({ id, name, set, cost, category, rarity, role: 'guerrier', hp: 10, atk: 10, abilities: [], image: null }) as unknown as Card;

const CARDS = [
  card('mx-neo', 'Néo a.k.a L’élu', 'matrix', 10, 'character', 'legendary'),
  card('mx-matrice', 'La Matrice', 'matrix', null, 'terrain', 'legendary'),
  card('mx-tank', 'Tank', 'matrix', 1),
  card('mx-emp', 'E.M.P', 'matrix', 8, 'spell', 'epic'),
  card('hg-arthur', 'Arthur, roi des Bretons', 'holy-grail', 9, 'character', 'legendary'),
  card('hg-patsy', 'Patsy', 'holy-grail', 1),
  card('hs-topper', 'Topper Harley', 'hot-shots', 9, 'character', 'legendary'),
  card('wc-apu', 'Unité A.P.U', 'white-chicks', 6, 'equipment', 'epic'),
];
const TITLES = { matrix: 'Matrix', 'holy-grail': 'Sacré Graal', 'hot-shots': 'Hot Shots!', 'white-chicks': 'White Chicks' };
const ids = (cs: Card[]) => cs.map((c) => c.id);
const none = new Set<string>();

describe('search', () => {
  it('ignores accents, case and extra spaces', () => {
    expect(fold('  Néo  A.K.A ')).toBe('neo a.k.a');
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, query: 'NEO' }, none, 'cost'))).toEqual(['mx-neo']);
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, query: 'unite' }, none, 'cost'))).toEqual(['wc-apu']);
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, query: "l'elu" }, none, 'cost'))).toEqual(['mx-neo']);
    expect(filterCards(CARDS, { ...NO_FILTERS, query: 'personne' }, none, 'cost')).toEqual([]);
  });
});

describe('filters', () => {
  it('combines film, category, rarity and cost (several values = any of them)', () => {
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, sets: ['matrix'] }, none, 'cost'))).toEqual(['mx-matrice', 'mx-tank', 'mx-emp', 'mx-neo']);
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, sets: ['matrix', 'holy-grail'], categories: ['character'] }, none, 'cost'))).toEqual(['hg-patsy', 'mx-tank', 'hg-arthur', 'mx-neo']);
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, rarities: ['epic'] }, none, 'name'))).toEqual(['mx-emp', 'wc-apu']);
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, costs: ['9+'] }, none, 'cost'))).toEqual(['hg-arthur', 'hs-topper', 'mx-neo']);
    // a terrain without a cost counts as 0
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, costs: ['0-2'] }, none, 'cost'))).toEqual(['mx-matrice', 'hg-patsy', 'mx-tank']);
    expect(costBand(0)).toBe('0-2');
    expect(costBand(4)).toBe('3-4');
    expect(costBand(7)).toBe('7-8');
    expect(costBand(13)).toBe('9+');
  });

  it('hides the deck on demand and counts the chosen values', () => {
    const deck = new Set(['mx-neo', 'mx-tank']);
    expect(ids(filterCards(CARDS, { ...NO_FILTERS, sets: ['matrix'], hideDeck: true }, deck, 'cost'))).toEqual(['mx-matrice', 'mx-emp']);
    expect(activeCount(NO_FILTERS)).toBe(0);
    expect(activeCount({ ...NO_FILTERS, query: 'neo', sets: ['matrix'], costs: ['0-2', '9+'], hideDeck: true })).toBe(4);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggle(['b'], 'a')).toEqual(['b', 'a']);
  });
});

describe('sort', () => {
  it('sorts by cost then name, by name, or by film then cost', () => {
    expect(ids(sortCards(CARDS, 'cost')).slice(0, 3)).toEqual(['mx-matrice', 'hg-patsy', 'mx-tank']);
    expect(ids(sortCards(CARDS, 'name'))).toEqual(['hg-arthur', 'mx-emp', 'mx-matrice', 'mx-neo', 'hg-patsy', 'mx-tank', 'hs-topper', 'wc-apu']);
    const order = filmList(CARDS, TITLES).map((f) => f.set);
    expect(ids(sortCards(CARDS, 'set', order))).toEqual(['mx-matrice', 'mx-tank', 'mx-emp', 'mx-neo', 'hg-patsy', 'hg-arthur', 'hs-topper', 'wc-apu']);
    // the input is not changed
    expect(CARDS[0]!.id).toBe('mx-neo');
  });
});

describe('films, curve and texts', () => {
  it('lists films with their card count, most first, searchable without accents', () => {
    expect(filmList(CARDS, TITLES)).toEqual([
      { set: 'matrix', title: 'Matrix', count: 4 },
      { set: 'holy-grail', title: 'Sacré Graal', count: 2 },
      { set: 'hot-shots', title: 'Hot Shots!', count: 1 },
      { set: 'white-chicks', title: 'White Chicks', count: 1 },
    ]);
    expect(filmList(CARDS, TITLES, 'sacre').map((f) => f.title)).toEqual(['Sacré Graal']);
    expect(deckFilms(CARDS.slice(3), TITLES)).toEqual(['Sacré Graal', 'Hot Shots!', 'Matrix', 'White Chicks']);
  });

  it('builds the cost curve with a 9+ column', () => {
    expect(costCurve(CARDS)).toEqual([1, 2, 0, 0, 0, 0, 1, 0, 1, 3]);
  });

  it('shortens validation messages and copy names', () => {
    expect(shortError('Il manque 3 cartes (50 exactement).')).toBe('Il manque 3 cartes');
    expect(shortError('1 carte de trop (50 exactement).')).toBe('1 carte de trop');
    expect(shortError('« Néo » n’est pas encore jouable.')).toBe('« Néo » n’est pas encore jouable');
    expect(copyName('Escadrille Graal')).toBe('Escadrille Graal (copie)');
    const long = copyName('x'.repeat(30));
    expect(long).toBe('x'.repeat(22) + ' (copie)');
    expect([...long].length).toBe(30);
  });
});
