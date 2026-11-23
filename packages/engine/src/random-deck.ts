import { DECK_SIZE } from '@cinecards/cards/deck';
import { shuffleInPlace } from './rng.ts';

/**
 * A constructed deck drawn at random (story 10.3: the Grimoire's deck in solo): DECK_SIZE distinct cards taken from
 * `playable`, the same for the same seed whatever the order of `playable`. Fewer playable cards = all of them.
 */
export function randomDeck(playable: Iterable<string>, seed: number): string[] {
  const holder = { rng: (seed * 2654435761) >>> 0 };
  return shuffleInPlace(holder, [...new Set(playable)].sort()).slice(0, DECK_SIZE);
}
