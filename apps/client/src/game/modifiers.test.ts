import { computeStats } from '@cinecards/engine';
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog.ts';
import { devScene } from './devscene.ts';
import { durationFr, modifierLines, sourceCounts } from './modifiers.ts';

describe('where bonuses and penalties come from (story 13.3)', () => {
  const state = devScene(CATALOG, 'sources')!;
  const iidOf = (cardId: string) => Object.values(state.instances).find((i) => i.cardId === cardId)!.iid;
  const lancelot = iidOf('hg-lancelot');
  const stats = computeStats(CATALOG, state, lancelot);
  const lines = modifierLines(CATALOG, state, lancelot, stats.sources);

  it('lists each source card with its ability, value, duration and whether it is still in play', () => {
    const by = (cardId: string) => lines.find((l) => l.cardId === cardId)!;
    expect(by('wc-vandergeld')).toMatchObject({ label: 'Langue de vipère', atk: -30, tone: 'malus', inPlay: true, self: false, duration: 'permanent', ability: 0 });
    expect(by('mx-pills')).toMatchObject({ atk: 100, hp: 100, tone: 'buff', inPlay: false, duration: 'permanent', ability: 0 });
    // auras: Arthur's (a character) and Camelot's (a terrain) count as sources, for as long as they stay
    expect(by('hg-arthur')).toMatchObject({ atk: 20, tone: 'buff', inPlay: true, duration: 'tant qu’elle est en jeu', ability: 1 });
    expect(by('hg-camelot')).toMatchObject({ hp: 30, tone: 'buff', inPlay: true, duration: 'tant qu’elle est en jeu' });
  });

  it('counts the sources of each badge', () => {
    expect(sourceCounts(stats.sources)).toEqual({ atk: 4, hp: 2 }); // + the A.P.U (story 13.5)
    expect(sourceCounts(undefined)).toEqual({ atk: 0, hp: 0 });
  });

  it('a card that boosts itself is not linked to itself', () => {
    const arthur = iidOf('hg-arthur');
    const own = modifierLines(CATALOG, state, arthur, computeStats(CATALOG, state, arthur).sources);
    expect(own.find((l) => l.cardId === 'hg-arthur')).toMatchObject({ self: true });
  });

  it('says how long a modifier lasts', () => {
    expect(durationFr({ turnsLeft: 1 })).toBe('encore 1 tour');
    expect(durationFr({ turnsLeft: 2 })).toBe('encore 2 tours');
    expect(durationFr({})).toBe('permanent');
  });
});
