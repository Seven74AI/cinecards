/** Deck builder filters and sort (story 10.2). Pure: no React, no catalog import, so it is easy to test. */
import type { Card } from '@cinecards/cards';

export type SortKey = 'cost' | 'name' | 'set';
export const SORT_FR: Record<SortKey, string> = { cost: 'coût', name: 'nom', set: 'film' };

/** Cost bands of the filter sheet (mockup B); a card without a cost (terrains) counts as 0. */
export const COST_BANDS = ['0-2', '3-4', '5-6', '7-8', '9+'] as const;
export type CostBand = (typeof COST_BANDS)[number];
export const COST_BAND_FR: Record<CostBand, string> = { '0-2': '0–2', '3-4': '3–4', '5-6': '5–6', '7-8': '7–8', '9+': '9+' };

export const CATEGORIES = ['character', 'spell', 'equipment', 'terrain'] as const;
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export interface DeckFilters {
  /** Free text, matched against the card name without accents or case. */
  query: string;
  /** Set ids ("Film"); empty = every film. */
  sets: string[];
  categories: string[];
  rarities: string[];
  costs: CostBand[];
  /** "Masquer mon deck": hides the cards already in the deck. */
  hideDeck: boolean;
}

export const NO_FILTERS: DeckFilters = { query: '', sets: [], categories: [], rarities: [], costs: [], hideDeck: false };

/** Lower case, accents removed, spaces squeezed: "Néo  a.k.a" → "neo a.k.a". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export const costOf = (c: Pick<Card, 'cost'>) => c.cost ?? 0;

export function costBand(cost: number): CostBand {
  if (cost <= 2) return '0-2';
  if (cost <= 4) return '3-4';
  if (cost <= 6) return '5-6';
  if (cost <= 8) return '7-8';
  return '9+';
}

/** Number of filter values chosen in the sheet ("Filtres · N"); the search text is not counted. */
export const activeCount = (f: DeckFilters) => f.sets.length + f.categories.length + f.rarities.length + f.costs.length + (f.hideDeck ? 1 : 0);

/** Adds the value when absent, removes it when present. */
export const toggle = <T>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** True when the card passes every filter (an empty list lets everything through). */
export function matches(card: Card, f: DeckFilters, inDeck: ReadonlySet<string>): boolean {
  if (f.hideDeck && inDeck.has(card.id)) return false;
  if (f.sets.length && !f.sets.includes(card.set)) return false;
  if (f.categories.length && !f.categories.includes(card.category)) return false;
  if (f.rarities.length && !f.rarities.includes(card.rarity)) return false;
  if (f.costs.length && !f.costs.includes(costBand(costOf(card)))) return false;
  const q = fold(f.query);
  return !q || fold(card.name).includes(q);
}

const byName = (a: Card, b: Card) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

/**
 * Sorts a copy: by cost (then name), by name, or by film (in `setOrder`, then cost, then name).
 * Ties end on the id so the order never depends on the input.
 */
export function sortCards(cards: readonly Card[], key: SortKey, setOrder: readonly string[] = []): Card[] {
  const setIdx = (c: Card) => {
    const i = setOrder.indexOf(c.set);
    return i < 0 ? setOrder.length : i;
  };
  const cmp = (a: Card, b: Card) => {
    let d = 0;
    if (key === 'set') d = setIdx(a) - setIdx(b) || a.set.localeCompare(b.set);
    if (!d && key !== 'name') d = costOf(a) - costOf(b);
    if (!d) d = byName(a, b);
    return d || a.id.localeCompare(b.id);
  };
  return [...cards].sort(cmp);
}

/** The grid of the builder: filtered, then sorted. */
export const filterCards = (cards: readonly Card[], f: DeckFilters, inDeck: ReadonlySet<string>, key: SortKey, setOrder: readonly string[] = []) =>
  sortCards(
    cards.filter((c) => matches(c, f, inDeck)),
    key,
    setOrder,
  );

export interface FilmEntry {
  set: string;
  title: string;
  count: number;
}

/** Films of the filter sheet: those with cards, most cards first, then by title; `query` searches the title. */
export function filmList(cards: readonly Card[], titles: Readonly<Record<string, string>>, query = ''): FilmEntry[] {
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c.set, (counts.get(c.set) ?? 0) + 1);
  const q = fold(query);
  return [...counts]
    .map(([set, count]) => ({ set, title: titles[set] ?? set, count }))
    .filter((e) => !q || fold(e.title).includes(q))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'fr'));
}

/** Cards per cost, 0 to 8 then "9+" (10 columns), for the curve of "Mon deck". */
export function costCurve(cards: readonly Pick<Card, 'cost'>[]): number[] {
  const out = Array.from({ length: 10 }, () => 0);
  for (const c of cards) out[Math.min(9, costOf(c))]!++;
  return out;
}

/** The first validation message without the "(50 exactement)." tail: "Il manque 3 cartes". */
export const shortError = (message: string) => message.replace(/\s*\([^)]*\)\s*\.?$/, '').replace(/\.$/, '');

/** Films of a deck, most represented first ("Sacré Graal · Matrix · …"). */
export function deckFilms(cards: readonly Card[], titles: Readonly<Record<string, string>>): string[] {
  return filmList(cards, titles).map((e) => e.title);
}

/** A copy's name: "Nom (copie)", shortened so it stays within `max` characters. */
export function copyName(name: string, max = 30): string {
  const tail = ' (copie)';
  const base = [...name.trim()];
  return (base.length + tail.length > max ? base.slice(0, max - tail.length).join('').trimEnd() : base.join('')) + tail;
}
