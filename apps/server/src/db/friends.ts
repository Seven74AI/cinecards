import type { Db } from './db.ts';

/** One friendship row (story 8.3): `a` < `b`; a pending row is a request sent by `requested_by`. */
export interface FriendshipRow {
  a: number;
  b: number;
  requested_by: number;
  status: 'pending' | 'accepted';
  created_at: number;
  accepted_at: number | null;
}

/** The other side of a friendship, as listed for one account. */
export interface FriendLink {
  id: number;
  nickname: string;
  status: 'pending' | 'accepted';
  requestedBy: number;
}

const pair = (x: number, y: number): [number, number] => (x < y ? [x, y] : [y, x]);

export const findFriendship = (db: Db, x: number, y: number) => db.prepare('SELECT * FROM friendships WHERE a = ? AND b = ?').get(...pair(x, y)) as FriendshipRow | undefined;

/** Inserts a pending request from `from` to `to`; false when the pair already has a row. */
export function insertRequest(db: Db, from: number, to: number, now: number): boolean {
  const [a, b] = pair(from, to);
  const r = db.prepare("INSERT INTO friendships (a, b, requested_by, status, created_at) VALUES (?, ?, ?, 'pending', ?) ON CONFLICT(a, b) DO NOTHING").run(a, b, from, now);
  return Number(r.changes) > 0;
}

/** Turns a pending request into a friendship; false when there was no pending row. */
export function acceptFriendship(db: Db, x: number, y: number, now: number): boolean {
  const r = db.prepare("UPDATE friendships SET status = 'accepted', accepted_at = ? WHERE a = ? AND b = ? AND status = 'pending'").run(now, ...pair(x, y));
  return Number(r.changes) > 0;
}

/** Removes the pair's row whatever its state (decline, cancel or remove); false when there was none. */
export function deleteFriendship(db: Db, x: number, y: number): boolean {
  return Number(db.prepare('DELETE FROM friendships WHERE a = ? AND b = ?').run(...pair(x, y)).changes) > 0;
}

/** Every friendship and request of an account, with the other side's nickname, sorted by nickname. */
export function listFriendships(db: Db, id: number): FriendLink[] {
  const rows = db
    .prepare(
      `SELECT acc.id AS id, acc.nickname AS nickname, f.status AS status, f.requested_by AS requestedBy
       FROM friendships f JOIN accounts acc ON acc.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END
       WHERE f.a = ? OR f.b = ?
       ORDER BY acc.nickname_key`,
    )
    .all(id, id, id) as unknown as FriendLink[];
  return rows.map((r) => ({ id: Number(r.id), nickname: r.nickname, status: r.status, requestedBy: Number(r.requestedBy) }));
}

/** Ids of the accepted friends of an account. */
export const friendIds = (db: Db, id: number) =>
  (db.prepare("SELECT CASE WHEN a = ? THEN b ELSE a END AS id FROM friendships WHERE (a = ? OR b = ?) AND status = 'accepted'").all(id, id, id) as { id: number }[]).map((r) => Number(r.id));

export const countFriends = (db: Db, id: number) => Number((db.prepare("SELECT COUNT(*) AS n FROM friendships WHERE (a = ? OR b = ?) AND status = 'accepted'").get(id, id) as { n: number }).n);

export const countOutgoing = (db: Db, id: number) => Number((db.prepare("SELECT COUNT(*) AS n FROM friendships WHERE requested_by = ? AND status = 'pending'").get(id) as { n: number }).n);
