import type { Card } from './schema.ts';

/** Constructed decks hold exactly this many cards, one copy of each (Root's rule, 2026-11-22). */
export const DECK_SIZE = 50;

export type DeckErrorCode = 'size' | 'duplicate' | 'unknown' | 'unplayable';

export interface DeckError {
  code: DeckErrorCode;
  /** Player-facing text, in French. */
  message: string;
  /** The card concerned (all codes but `size`). */
  cardId?: string;
}

export type DeckValidation = { ok: true } | { ok: false; errors: DeckError[] };

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/**
 * Checks a constructed deck: exactly DECK_SIZE cards, one copy each, every card known and playable.
 * `playable` is the engine's `playableCardIds(catalog)`: it is passed in because `cards` must not import the engine.
 * Errors come sorted: size, then duplicates, unknown cards, unplayable cards (each in deck order).
 */
export function validateDeck(cardIds: readonly string[], catalog: ReadonlyMap<string, Card>, playable: Iterable<string>): DeckValidation {
  const playableSet = new Set(playable);
  const errors: DeckError[] = [];
  if (cardIds.length < DECK_SIZE) errors.push({ code: 'size', message: `Il manque ${plural(DECK_SIZE - cardIds.length, 'carte')} (${DECK_SIZE} exactement).` });
  if (cardIds.length > DECK_SIZE) errors.push({ code: 'size', message: `${plural(cardIds.length - DECK_SIZE, 'carte')} de trop (${DECK_SIZE} exactement).` });

  const seen = new Set<string>();
  const doubled = new Set<string>();
  const unique: string[] = [];
  for (const id of cardIds) {
    if (seen.has(id)) doubled.add(id);
    else unique.push(id);
    seen.add(id);
  }
  const nameOf = (id: string) => catalog.get(id)?.name ?? id;
  for (const id of unique) if (doubled.has(id)) errors.push({ code: 'duplicate', cardId: id, message: `« ${nameOf(id)} » est en double : une seule copie par carte.` });
  for (const id of unique) if (!catalog.has(id)) errors.push({ code: 'unknown', cardId: id, message: `Carte inconnue : ${id}.` });
  for (const id of unique) {
    if (catalog.has(id) && !playableSet.has(id)) errors.push({ code: 'unplayable', cardId: id, message: `« ${nameOf(id)} » n'est pas encore jouable.` });
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
