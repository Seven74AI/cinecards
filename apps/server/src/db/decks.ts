import type { Db } from './db.ts';

/** One saved deck (story 10.2); `cards` is stored as a JSON array of card ids. */
export interface DeckRow {
  id: number;
  account_id: number;
  name: string;
  cards: string;
  created_at: number;
  updated_at: number;
}

/** The decks of an account, most recently changed first. */
export const listDecks = (db: Db, accountId: number) =>
  (db.prepare('SELECT * FROM decks WHERE account_id = ? ORDER BY updated_at DESC, id DESC').all(accountId) as unknown as DeckRow[]).map(normalize);

/** A deck, only when it belongs to the account. */
export function findDeck(db: Db, id: number, accountId: number): DeckRow | undefined {
  const row = db.prepare('SELECT * FROM decks WHERE id = ? AND account_id = ?').get(id, accountId) as DeckRow | undefined;
  return row ? normalize(row) : undefined;
}

export const countDecks = (db: Db, accountId: number) => Number((db.prepare('SELECT COUNT(*) AS n FROM decks WHERE account_id = ?').get(accountId) as { n: number }).n);

export function insertDeck(db: Db, accountId: number, name: string, cards: string[], now: number): number {
  const r = db.prepare('INSERT INTO decks (account_id, name, cards, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(accountId, name, JSON.stringify(cards), now, now);
  return Number(r.lastInsertRowid);
}

/** Replaces the name and cards of an account's deck; false when it has no such deck. */
export function updateDeck(db: Db, id: number, accountId: number, name: string, cards: string[], now: number): boolean {
  const r = db.prepare('UPDATE decks SET name = ?, cards = ?, updated_at = ? WHERE id = ? AND account_id = ?').run(name, JSON.stringify(cards), now, id, accountId);
  return Number(r.changes) > 0;
}

/** Deletes an account's deck; false when it has no such deck. */
export const deleteDeck = (db: Db, id: number, accountId: number) => Number(db.prepare('DELETE FROM decks WHERE id = ? AND account_id = ?').run(id, accountId).changes) > 0;

/** Reads a stored card list; anything unreadable counts as an empty deck. */
export function parseCards(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const normalize = (r: DeckRow): DeckRow => ({ ...r, id: Number(r.id), account_id: Number(r.account_id), created_at: Number(r.created_at), updated_at: Number(r.updated_at) });
