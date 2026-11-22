import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db.ts';

export const BACKUPS_KEPT = 7;
const NAME = /^cinecards-\d{4}-\d{2}-\d{2}\.db$/;

/** Writes today's copy (UTC date) with `VACUUM INTO` if it is missing, then keeps the 7 most recent. Returns the file written, if any. */
export function backupIfDue(db: Db, dataDir: string, now: number): string | null {
  if (dataDir === ':memory:') return null;
  const dir = join(dataDir, 'backups');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `cinecards-${new Date(now).toISOString().slice(0, 10)}.db`);
  let written: string | null = null;
  if (!existsSync(file)) {
    db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
    written = file;
  }
  const old = readdirSync(dir)
    .filter((f) => NAME.test(f))
    .sort()
    .reverse()
    .slice(BACKUPS_KEPT);
  for (const f of old) rmSync(join(dir, f), { force: true });
  return written;
}

/**
 * Database upkeep: at start-up, then every hour, runs `hourly` (e.g. the session purge) and makes the day's copy
 * if it is missing — so one copy per day. Returns a function that stops the timer.
 */
export function startMaintenance(db: Db, dataDir: string, hourly: () => void = () => {}, now: () => number = Date.now): () => void {
  const run = () => {
    try {
      hourly();
      backupIfDue(db, dataDir, now());
    } catch (err) {
      console.error('database maintenance failed', err);
    }
  };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
