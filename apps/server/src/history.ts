import type { PlayerId } from '@cinecards/engine';
import type { Account, AuthError, AuthResult } from './auth/service.ts';
import type { Db } from './db/db.ts';
import { recentGames, record, recordGame, type GameRecord, type GameResult, type GameTally, type PlayedGame } from './db/games.ts';

/** How many games `GET /api/history` lists (every game stays in the database). */
export const HISTORY_LIMIT = 20;

export interface HistoryList {
  record: GameTally;
  games: PlayedGame[];
}

/** A finished duel as the room hands it over: who sat where, and how the engine ended it. */
export interface FinishedDuel {
  mode: string;
  turns: number;
  startedAt: number;
  endedAt: number;
  accounts: [number | null, number | null];
  names: [string, string];
  winner: PlayerId | 'draw';
  /** The seat whose `conceded` event ended the game (an "Abandonner" or the 90 s forfeit), if any. */
  concededBy: PlayerId | null;
}

/** Each seat's result from its own point of view, from the engine's final state only. */
export function seatResults(winner: PlayerId | 'draw', concededBy: PlayerId | null): [GameResult, GameResult] {
  const one = (seat: PlayerId): GameResult => {
    if (winner === 'draw') return 'draw';
    if (concededBy !== null) return concededBy === seat ? 'conceded' : 'opponent_conceded';
    return winner === seat ? 'win' : 'loss';
  };
  return [one(0), one(1)];
}

/**
 * Game history (story 8.4): the duel rooms record each finished online game where at least one seat has an
 * account; an account reads its record and latest games over HTTP.
 */
export class HistoryService {
  constructor(
    private readonly db: Db,
    private readonly accountOf: (token: unknown) => Account | null,
  ) {}

  /** Saves a finished duel; a game between two guests is not kept. Never throws (a duel must end even if the disk fails). */
  record(d: FinishedDuel): number | null {
    if (d.accounts[0] === null && d.accounts[1] === null) return null;
    const results = seatResults(d.winner, d.concededBy);
    const game: GameRecord = {
      mode: d.mode,
      turns: d.turns,
      startedAt: d.startedAt,
      endedAt: d.endedAt,
      players: [0, 1].map((s) => ({
        accountId: d.accounts[s]!,
        nickname: d.names[s]!,
        result: results[s]!,
      })) as GameRecord['players'],
    };
    try {
      return recordGame(this.db, game);
    } catch (err) {
      console.error('history: could not record a game', err);
      return null;
    }
  }

  list(token: unknown): AuthResult<HistoryList> {
    const me = this.accountOf(token);
    if (!me)
      return {
        ok: false,
        status: 401,
        error: 'unauthorized',
        message: 'Ta session a expiré. Reconnecte-toi.',
      } satisfies AuthError;
    return {
      ok: true,
      record: record(this.db, me.id),
      games: recentGames(this.db, me.id, HISTORY_LIMIT),
    };
  }
}
