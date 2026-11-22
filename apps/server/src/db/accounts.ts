import type { Db } from './db.ts';

export interface AccountRow {
  id: number;
  nickname: string;
  nickname_key: string;
  /** Null for an account that only has a passkey (story 8.2). */
  password_hash: string | null;
  recovery_hash: string;
  created_at: number;
  /** WebAuthn user handle, base64url; null until the first passkey (story 8.2). */
  webauthn_user_id: string | null;
}

/** Inserts an account; returns its id, or null when the nickname key is already taken. */
export function insertAccount(db: Db, a: { nickname: string; key: string; passwordHash: string | null; recoveryHash: string; now: number }): number | null {
  const r = db
    .prepare('INSERT INTO accounts (nickname, nickname_key, password_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(nickname_key) DO NOTHING')
    .run(a.nickname, a.key, a.passwordHash, a.recoveryHash, a.now);
  return Number(r.changes) === 0 ? null : Number(r.lastInsertRowid);
}

export const findAccountByKey = (db: Db, key: string) => db.prepare('SELECT * FROM accounts WHERE nickname_key = ?').get(key) as AccountRow | undefined;

export const findAccountById = (db: Db, id: number) => db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;

export const setPasswordHash = (db: Db, id: number, hash: string | null) => void db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hash, id);

export const setRecoveryHash = (db: Db, id: number, hash: string) => void db.prepare('UPDATE accounts SET recovery_hash = ? WHERE id = ?').run(hash, id);

/** Sets the WebAuthn user handle if the account has none yet; returns the handle the account ends up with. */
export function ensureWebauthnUserId(db: Db, id: number, candidate: string): string {
  db.prepare('UPDATE accounts SET webauthn_user_id = ? WHERE id = ? AND webauthn_user_id IS NULL').run(candidate, id);
  return (db.prepare('SELECT webauthn_user_id FROM accounts WHERE id = ?').get(id) as { webauthn_user_id: string | null } | undefined)?.webauthn_user_id ?? candidate;
}
