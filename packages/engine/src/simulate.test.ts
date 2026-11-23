import { describe, expect, it } from 'vitest';
import { botRandom, botStep, createGame, playableCardIds, type DeckMode, type GameState, type PlayerId } from './index.ts';
import { shuffleInPlace } from './rng.ts';
import { MVP } from './scenario.ts';

/** Two 50-card decks drawn from the playable cards with the game's seed (story 10.1). */
function seededDecks(seed: number): [string[], string[]] {
  const rng = { rng: (seed * 2654435761) >>> 0 };
  const pick = () => shuffleInPlace(rng, playableCardIds(MVP).sort()).slice(0, 50);
  return [pick(), pick()];
}

/** Story 4.5: 200 random games with every MVP card must end cleanly (story 10.1: once more in constructed mode). */
describe('4.5 random simulation', () => {
  it('200 random games finish without crash and with a winner', () => {
    const report = run((seed) => (seed % 2 ? 'shared' : 'randomSplit'));
    console.log('simulation', JSON.stringify(report));
    expect(report.finished).toBeGreaterThanOrEqual(190);
  }, 120000);

  it('200 random constructed games finish without crash or loop', () => {
    const report = run(() => 'constructed');
    console.log('simulation constructed', JSON.stringify(report));
    expect(report.finished).toBe(200);
  }, 120000);
});

function run(modeOf: (seed: number) => DeckMode) {
  const report = { games: 0, finished: 0, wins: [0, 0], turns: 0, actions: 0, longest: 0, mode: { shared: 0, randomSplit: 0, constructed: 0 } };
  for (let seed = 1; seed <= 200; seed++) {
    const deckMode = modeOf(seed);
    const decks = deckMode === 'constructed' ? seededDecks(seed) : undefined;
    let state: GameState = createGame(MVP, { seed, mode: deckMode, decks }).state;
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
  return report;
}
