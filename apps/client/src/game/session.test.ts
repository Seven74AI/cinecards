import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botRandom, botStep, type GameState, type PlayerId } from '@cinecards/engine';
import { MVP } from '../../../../packages/engine/src/scenario.ts';
import { localSession } from './session.ts';

const actorOf = (s: GameState): PlayerId => (s.pending ? s.pending.player : s.active);
const modeOf = (seed: number) => (seed % 2 ? ('shared' as const) : ('randomSplit' as const));

describe('11.1 solo never stalls when Le Grimoire starts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('the bot plays its opening turn and hands over to the player', () => {
    let botFirst = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const session = localSession(MVP, { kind: 'bot', mode: modeOf(seed), seed });
      if (session.get().state.active !== 1) {
        session.dispose();
        continue;
      }
      botFirst++;
      let ticks = 0;
      while (session.get().state.phase !== 'finished' && actorOf(session.get().state) === 1 && ticks < 500) {
        vi.advanceTimersByTime(1000);
        ticks++;
      }
      const s = session.get().state;
      expect(s.phase === 'finished' || actorOf(s) === 0, `seed ${seed}: bot stalled`).toBe(true);
      expect(s.players[0].turnNumber, `seed ${seed}: player never got the hand`).toBeGreaterThanOrEqual(s.phase === 'finished' ? 0 : 1);
      session.dispose();
    }
    expect(botFirst).toBeGreaterThan(50);
  });

  it('300 solo games all reach a winner or advance well past turn 1', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const session = localSession(MVP, { kind: 'bot', mode: modeOf(seed), seed });
      const human = botRandom(seed * 7919);
      let steps = 0;
      while (session.get().state.phase !== 'finished' && steps < 3000) {
        const s = session.get().state;
        if (actorOf(s) === 0) {
          const step = botStep(MVP, s, 0, human);
          if (!step) throw new Error(`seed ${seed}: player has no action`);
          session.send(step.action);
        } else {
          vi.advanceTimersByTime(1000);
        }
        steps++;
      }
      const s = session.get().state;
      const turns = s.players[0].turnNumber + s.players[1].turnNumber;
      expect(s.phase === 'finished' || turns > 6, `seed ${seed}: stalled at turn ${turns}`).toBe(true);
      expect(s.players[1].turnNumber, `seed ${seed}: bot never played`).toBeGreaterThanOrEqual(1);
      session.dispose();
    }
  }, 120000);

  it('dispose cancels a pending bot move', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const session = localSession(MVP, { kind: 'bot', mode: 'shared', seed });
      if (session.get().state.active !== 1) {
        session.dispose();
        continue;
      }
      const before = session.get().seq;
      session.dispose();
      vi.advanceTimersByTime(5000);
      expect(session.get().seq).toBe(before);
      return;
    }
    throw new Error('no seed where the bot starts');
  });
});
