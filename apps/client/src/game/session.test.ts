import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { botRandom, botStep, type GameState, type PlayerId } from '@cinecards/engine';
import { MVP } from '../../../../packages/engine/src/scenario.ts';
import { LocalClock, localSession } from './session.ts';
import { localDeadline } from '../net/online.ts';

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

describe('11.3 turn timer in solo and hot seat', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const seedWhere = (starter: PlayerId) => {
    for (let seed = 1; seed < 200; seed++) {
      const s = localSession(MVP, { kind: 'bot', mode: 'shared', seed });
      const ok = s.get().state.active === starter;
      s.dispose();
      if (ok) return seed;
    }
    throw new Error('no seed');
  };

  it('solo: the 75 s clock runs from the first turn and ends the player turn at 0', () => {
    const session = localSession(MVP, { kind: 'bot', mode: 'shared', seed: seedWhere(0) });
    expect(session.get().turnEndsAt).toBe(Date.now() + 75000);
    vi.advanceTimersByTime(74000);
    expect(session.get().state.active).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(session.get().state.active).toBe(1);
    session.dispose();
  });

  it('hot seat: the clock waits for the pass-the-device screen, then runs', () => {
    const session = localSession(MVP, { kind: 'hotseat', mode: 'shared', seed: 5 });
    const first = session.get().state.active;
    expect(session.get().turnEndsAt).toBeNull();
    expect(session.get().turnMsLeft).toBe(75000);
    vi.advanceTimersByTime(120000);
    expect(session.get().state.active).toBe(first);
    session.ready!();
    expect(session.get().turnEndsAt).toBe(Date.now() + 75000);
    vi.advanceTimersByTime(75000);
    expect(session.get().state.active).not.toBe(first);
    // the next player gets a full, paused clock until they take the device
    expect(session.get().turnEndsAt).toBeNull();
    expect(session.get().turnMsLeft).toBe(75000);
    session.dispose();
  });

  it('the turn clock pauses during a reaction window, which passes itself after 5 s', () => {
    const turn = vi.fn();
    const reaction = vi.fn();
    const clock = new LocalClock(turn, reaction);
    const sess = localSession(MVP, { kind: 'hotseat', mode: 'shared', seed: 3 });
    const s = sess.get().state;
    sess.dispose();
    clock.sync(s, true);
    vi.advanceTimersByTime(30000);
    const withReaction: GameState = { ...s, pending: { kind: 'reaction', player: 1, options: [], key: 'k' } };
    clock.sync(withReaction, false);
    expect(clock.turnEndsAt).toBeNull();
    expect(clock.turnMsLeft).toBe(45000);
    expect(clock.reactionEndsAt).toBe(Date.now() + 5000);
    vi.advanceTimersByTime(5000);
    expect(reaction).toHaveBeenCalledOnce();
    clock.sync(s, false);
    expect(clock.turnEndsAt).toBe(Date.now() + 45000);
    vi.advanceTimersByTime(45000);
    expect(turn).toHaveBeenCalledOnce();
    clock.dispose();
  });
});

describe('11.3 online countdown ignores clock skew', () => {
  it('uses the remaining time sent by the server, falling back to the absolute time', () => {
    const now = 1_000_000;
    // this device is 2 min behind the server: the absolute time alone would show 195 s
    expect(localDeadline(75000, now + 120000 + 75000, now)).toBe(now + 75000);
    expect(localDeadline(null, null, now)).toBeNull();
    expect(localDeadline(undefined, 12345, now)).toBe(12345);
  });
});
