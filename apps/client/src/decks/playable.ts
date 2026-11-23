import { useEffect, useState } from 'react';
import { validateDeck } from '@cinecards/cards';
import type { Catalog } from '@cinecards/engine';
import { listDecks, type SavedDeck } from '../account/api.ts';

/** Story 10.3: the saved decks that can be played (valid on the server and with this client's cards), by name. */
export function playableDecks(decks: SavedDeck[], catalog: Catalog, playable: Iterable<string>): SavedDeck[] {
  const ids = new Set(playable);
  return decks.filter((d) => d.valid && validateDeck(d.cards, catalog, ids).ok).sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.id - b.id);
}

/** The deck to preselect: the last one chosen on this device if it is still playable, else the first. */
export const defaultDeck = (decks: SavedDeck[], last: number | null): SavedDeck | null => decks.find((d) => d.id === last) ?? decks[0] ?? null;

const KEY = 'cinecards.deck';

/** Last deck chosen on this device (story 10.3), or null; storage may be blocked. */
export function lastDeckId(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function rememberDeck(id: number) {
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    /* private mode: not remembered */
  }
}

/** The playable decks of the signed-in account, loaded when `token` is set; null while loading or without account. */
export function usePlayableDecks(token: string | null, catalog: Catalog, playable: readonly string[], reload = 0): SavedDeck[] | null {
  const [decks, setDecks] = useState<SavedDeck[] | null>(null);
  useEffect(() => {
    if (!token) {
      setDecks(null);
      return;
    }
    let live = true;
    void listDecks(token).then((r) => {
      if (live) setDecks(r.ok ? playableDecks(r.data.decks, catalog, playable) : []);
    });
    return () => {
      live = false;
    };
  }, [token, catalog, playable, reload]);
  return decks;
}
