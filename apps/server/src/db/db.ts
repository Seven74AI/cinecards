import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

/** Numbered migrations (story 8.1): index i brings the schema from user_version i to i + 1. Never edit a shipped one. */
export const MIGRATIONS: string[] = [
  `CREATE TABLE accounts (
     id INTEGER PRIMARY KEY,
     nickname TEXT NOT NULL,
     nickname_key TEXT NOT NULL UNIQUE,
     password_hash TEXT,
     recovery_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     last_seen_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_account ON sessions(account_id);`,
];

/** The database file inside DATA_DIR, or ':memory:' (tests). */
export const dbPath = (dataDir: string) => (dataDir === ':memory:' ? ':memory:' : join(dataDir, 'cinecards.db'));

export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

export const schemaVersion = (db: Db) => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

/** Applies the migrations the database has not seen yet, each in its own transaction. Safe to run again. */
export function migrate(db: Db) {
  for (let v = schemaVersion(db); v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]!);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
