import type { Db } from './db.ts';

/** A session ends after 90 days without use (story 8.1). */
export const SESSION_IDLE_MS = 90 * 24 * 60 * 60 * 1000;
/** `last_seen_at` is pushed back at most once an hour, so reads stay cheap. */
const TOUCH_EVERY_MS = 60 * 60 * 1000;

export const createSession = (db: Db, tokenHash: string, accountId: number, now: number) =>
  void db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(tokenHash, accountId, now, now);

/** The account id of a live session, or null (unknown or expired; an expired one is deleted). */
export function readSession(db: Db, tokenHash: string, now: number): number | null {
  const row = db.prepare('SELECT account_id, last_seen_at FROM sessions WHERE token_hash = ?').get(tokenHash) as { account_id: number; last_seen_at: number } | undefined;
  if (!row) return null;
  if (now - row.last_seen_at > SESSION_IDLE_MS) {
    deleteSession(db, tokenHash);
    return null;
  }
  if (now - row.last_seen_at >= TOUCH_EVERY_MS) db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(now, tokenHash);
  return row.account_id;
}

export const deleteSession = (db: Db, tokenHash: string) => void db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);

export const deleteAccountSessions = (db: Db, accountId: number) => void db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId);

/** Removes every session unused for more than 90 days; returns how many. */
export const purgeSessions = (db: Db, now: number) => Number(db.prepare('DELETE FROM sessions WHERE last_seen_at < ?').run(now - SESSION_IDLE_MS).changes);
