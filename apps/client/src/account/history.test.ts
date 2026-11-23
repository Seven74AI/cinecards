import { describe, expect, it } from 'vitest';
import { modeLabel, opponentLabel, relativeDate, RESULT_LABEL, RESULT_TONE, turnsLabel } from './historyFormat.ts';

/** Story 8.4: the words of "Historique". */
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('8.4 history formatting', () => {
  // local time, so the calendar-day tests do not depend on the machine's time zone
  const now = new Date(2026, 10, 23, 15, 0).getTime();
  const min = 60_000;

  it('says how long ago a game ended, in French', () => {
    expect(relativeDate(now - 10_000, now)).toBe('à l’instant');
    expect(plain(relativeDate(now - 5 * min, now))).toBe('il y a 5 min');
    expect(plain(relativeDate(now - 59 * min, now))).toBe('il y a 59 min');
    expect(plain(relativeDate(now - 3 * 60 * min, now))).toBe('il y a 3 h');
    expect(relativeDate(new Date(2026, 10, 22, 23, 30).getTime(), now)).toBe('hier');
    expect(relativeDate(new Date(2026, 10, 22, 8, 0).getTime(), now)).toBe('hier');
    expect(plain(relativeDate(new Date(2026, 10, 12, 20, 0).getTime(), now))).toBe('12 nov.');
    // a clock a little ahead never says "dans"
    expect(relativeDate(now + 5000, now)).toBe('à l’instant');
  });

  it('names results, modes, turns, and opponents', () => {
    expect(RESULT_LABEL).toEqual({
      win: 'Victoire',
      loss: 'Défaite',
      draw: 'Nulle',
      conceded: 'Abandon',
      opponent_conceded: 'Victoire · abandon adverse',
    });
    expect(RESULT_TONE.conceded).toBe('loss');
    expect(RESULT_TONE.opponent_conceded).toBe('win');
    expect(modeLabel('shared')).toBe('Pioche commune');
    expect(modeLabel('randomSplit')).toBe('Decks aléatoires');
    expect(turnsLabel(1)).toBe('1 tour');
    expect(turnsLabel(12)).toBe('12 tours');
    expect(opponentLabel({ nickname: 'Bruno', isGuest: false })).toBe('Bruno');
    expect(opponentLabel({ nickname: 'Zoé', isGuest: true })).toBe('Invité · Zoé');
    expect(opponentLabel({ nickname: 'Invité', isGuest: true })).toBe('Invité');
  });
});
