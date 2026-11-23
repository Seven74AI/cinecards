import type { Db } from './db.ts';

/** A seat's result, from its own point of view (story 8.4). */
export type GameResult = 'win' | 'loss' | 'draw' | 'conceded' | 'opponent_conceded';

export interface GameSeat {
  /** null for a guest. */
  accountId: number | null;
  nickname: string;
  result: GameResult;
}

export interface GameRecord {
  mode: string;
  turns: number;
  startedAt: number;
  endedAt: number;
  /** Both seats, in seat order. */
  players: [GameSeat, GameSeat];
}

/** One past game as one account sees it. */
export interface PlayedGame {
  id: number;
  result: GameResult;
  opponent: { nickname: string; isGuest: boolean };
  mode: string;
  turns: number;
  endedAt: number;
  durationMs: number;
}

export interface GameTally {
  wins: number;
  losses: number;
  draws: number;
}

/** Saves a finished game and its two seats in one transaction; returns the game id. */
export function recordGame(db: Db, g: GameRecord): number {
  db.exec('BEGIN');
  try {
    const r = db.prepare('INSERT INTO games (mode, turns, started_at, ended_at) VALUES (?, ?, ?, ?)').run(g.mode, g.turns, g.startedAt, g.endedAt);
    const id = Number(r.lastInsertRowid);
    const seat = db.prepare('INSERT INTO game_players (game_id, seat, account_id, nickname, result) VALUES (?, ?, ?, ?, ?)');
    g.players.forEach((p, i) => seat.run(id, i, p.accountId, p.nickname, p.result));
    db.exec('COMMIT');
    return id;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

type Row = {
  id: number;
  result: GameResult;
  nickname: string;
  otherId: number | null;
  mode: string;
  turns: number;
  startedAt: number;
  endedAt: number;
};

/** The latest games of an account, most recent first (every game stays in the database). */
export function recentGames(db: Db, accountId: number, limit = 20): PlayedGame[] {
  const rows = db
    .prepare(
      `SELECT g.id AS id, me.result AS result, them.nickname AS nickname, them.account_id AS otherId,
              g.mode AS mode, g.turns AS turns, g.started_at AS startedAt, g.ended_at AS endedAt
       FROM game_players me
       JOIN games g ON g.id = me.game_id
       JOIN game_players them ON them.game_id = me.game_id AND them.seat <> me.seat
       WHERE me.account_id = ?
       ORDER BY me.game_id DESC
       LIMIT ?`,
    )
    .all(accountId, limit) as unknown as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    result: r.result,
    opponent: { nickname: r.nickname, isGuest: r.otherId === null },
    mode: r.mode,
    turns: Number(r.turns),
    endedAt: Number(r.endedAt),
    durationMs: Math.max(0, Number(r.endedAt) - Number(r.startedAt)),
  }));
}

/** Wins, losses and draws of an account over all its games: a concession counts as a loss, the other side's as a win. */
export function record(db: Db, accountId: number): GameTally {
  const rows = db.prepare('SELECT result, COUNT(*) AS n FROM game_players WHERE account_id = ? GROUP BY result').all(accountId) as unknown as { result: GameResult; n: number }[];
  const out: GameTally = { wins: 0, losses: 0, draws: 0 };
  for (const r of rows) {
    const n = Number(r.n);
    if (r.result === 'win' || r.result === 'opponent_conceded') out.wins += n;
    else if (r.result === 'loss' || r.result === 'conceded') out.losses += n;
    else out.draws += n;
  }
  return out;
}
