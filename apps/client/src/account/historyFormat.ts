/** Player-facing words of the history (story 8.4), kept apart from React so they can be tested. */
import type { GameResult, PlayedGame } from './api.ts';

/** The word next to the coloured dot, and the dot's tone. */
export const RESULT_LABEL: Record<GameResult, string> = {
  win: 'Victoire',
  loss: 'Défaite',
  draw: 'Nulle',
  conceded: 'Abandon',
  opponent_conceded: 'Victoire · abandon adverse',
};
export const RESULT_TONE: Record<GameResult, 'win' | 'loss' | 'draw'> = {
  win: 'win',
  loss: 'loss',
  draw: 'draw',
  conceded: 'loss',
  opponent_conceded: 'win',
};

export const modeLabel = (mode: string) => (mode === 'randomSplit' ? 'Decks aléatoires' : 'Pioche commune');

export const turnsLabel = (n: number) => `${n} tour${n > 1 ? 's' : ''}`;

const GUEST = 'Invité';
/** The other player: their nickname, or "Invité · <nickname typed>" for a guest. */
export const opponentLabel = (o: PlayedGame['opponent']) => (!o.isGuest ? o.nickname : o.nickname && o.nickname !== GUEST ? `${GUEST} · ${o.nickname}` : GUEST);

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "à l’instant", "il y a 5 min", "il y a 3 h", "hier", otherwise "12 nov." (local time). */
export function relativeDate(t: number, now = Date.now()): string {
  const diff = Math.max(0, now - t);
  const rtf = new Intl.RelativeTimeFormat('fr', {
    numeric: 'auto',
    style: 'short',
  });
  if (diff < 60_000) return 'à l’instant';
  if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute');
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (days <= 0) return rtf.format(-Math.floor(diff / 3_600_000), 'hour');
  if (days === 1) return rtf.format(-1, 'day');
  return new Intl.DateTimeFormat('fr', {
    day: 'numeric',
    month: 'short',
  }).format(t);
}
