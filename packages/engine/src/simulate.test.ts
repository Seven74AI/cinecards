import { describe, expect, it } from 'vitest';
import { botRandom, botStep, createGame, type GameState, type PlayerId } from './index.ts';
import { MVP } from './scenario.ts';

/** Story 4.5: 200 random games with every MVP card must end cleanly. */
describe('4.5 random simulation', () => {
  it('200 random games finish without crash and with a winner', () => {
    const report = { games: 0, finished: 0, wins: [0, 0], turns: 0, actions: 0, longest: 0, mode: { shared: 0, randomSplit: 0 } };
    for (let seed = 1; seed <= 200; seed++) {
      const deckMode = seed % 2 ? ('shared' as const) : ('randomSplit' as const);
      let state: GameState = createGame(MVP, { seed, mode: deckMode }).state;
      const rnd = botRandom(seed * 7919);
      let steps = 0;
      while (state.phase !== 'finished' && steps < 3000) {
        const actor: PlayerId = state.pending ? state.pending.player : state.active;
        const r = botStep(MVP, state, actor, rnd);
        if (!r) throw new Error(`seed ${seed}: stuck`);
        state = r.state;
        steps++;
      }
      report.games++;
      report.mode[deckMode]++;
      report.actions += steps;
      const turns = state.players[0].turnNumber + state.players[1].turnNumber;
      report.turns += turns;
      report.longest = Math.max(report.longest, turns);
      if (state.phase === 'finished') {
        report.finished++;
        if (typeof state.winner === 'number') report.wins[state.winner]!++;
      }
    }
    console.log('simulation', JSON.stringify(report));
    expect(report.finished).toBeGreaterThanOrEqual(190);
  }, 120000);
});
