import { describe, expect, it } from 'vitest';
import { createGame } from '@cinecards/engine';
import { describeEvent } from './describe.ts';
import { char } from '../../../../packages/engine/src/test-utils.ts';

const catalog = new Map([['a', char('a', 1, 100, 10, { name: 'Néo' })]]);
const names = { players: ['Toi', 'Adversaire'] as [string, string] };

describe('journal lines', () => {
  it('describes damage and turns in French', () => {
    const { state } = createGame(catalog, { seed: 1, autoStart: false });
    const iid = Object.keys(state.instances)[0]!;
    expect(describeEvent({ type: 'damageDealt', source: iid, target: iid, amount: 40, absorbed: 0 }, catalog, state, names)).toBe('Néo subit 40 dégâts.');
    expect(describeEvent({ type: 'turnStarted', player: 1, turnNumber: 3 }, catalog, state, names)).toBe('— Tour 3 de Adversaire —');
    expect(describeEvent({ type: 'gameOver', winner: 0 }, catalog, state, names)).toBe('Toi remporte la partie !');
  });
});
