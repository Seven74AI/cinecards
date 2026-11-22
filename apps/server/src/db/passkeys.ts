import type { Db } from './db.ts';

/** A passkey (WebAuthn credential) bound to an account (story 8.2). */
export interface PasskeyRow {
  /** Credential id, base64url. */
  id: string;
  account_id: number;
  public_key: Uint8Array;
  counter: number;
  /** JSON array of transports, as the authenticator reported them. */
  transports: string | null;
  /** The relying party (client hostname) the key was made for. */
  rp_id: string;
  name: string;
  created_at: number;
  last_used_at: number | null;
}

export const insertPasskey = (db: Db, p: Omit<PasskeyRow, 'last_used_at'>) =>
  void db
    .prepare('INSERT INTO passkeys (id, account_id, public_key, counter, transports, rp_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, p.account_id, p.public_key, p.counter, p.transports, p.rp_id, p.name, p.created_at);

export const listPasskeys = (db: Db, accountId: number) =>
  db.prepare('SELECT * FROM passkeys WHERE account_id = ? ORDER BY created_at, id').all(accountId) as unknown as PasskeyRow[];

export const findPasskey = (db: Db, id: string) => db.prepare('SELECT * FROM passkeys WHERE id = ?').get(id) as PasskeyRow | undefined;

export const touchPasskey = (db: Db, id: string, counter: number, now: number) =>
  void db.prepare('UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?').run(counter, now, id);

/** Removes a passkey only if it belongs to the account; returns whether one was removed. */
export const deletePasskey = (db: Db, id: string, accountId: number) => Number(db.prepare('DELETE FROM passkeys WHERE id = ? AND account_id = ?').run(id, accountId).changes) > 0;

export const countPasskeys = (db: Db, accountId: number) => (db.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE account_id = ?').get(accountId) as { n: number }).n;
