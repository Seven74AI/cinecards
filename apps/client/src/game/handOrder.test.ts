import { describe, expect, it } from 'vitest';
import { sortHand } from './handOrder.ts';

describe('sortHand (story 14.5)', () => {
  it('puts playable cards first and keeps the draw order inside each group', () => {
    const ok = new Set(['b', 'd']);
    expect(sortHand(['a', 'b', 'c', 'd', 'e'], (i) => ok.has(i))).toEqual(['b', 'd', 'a', 'c', 'e']);
  });
  it('leaves the hand as it is when every card (or none) is playable', () => {
    expect(sortHand(['a', 'b'], () => true)).toEqual(['a', 'b']);
    expect(sortHand(['a', 'b'], () => false)).toEqual(['a', 'b']);
  });
  it('does not change the hand it is given', () => {
    const hand = ['a', 'b'];
    sortHand(hand, (i) => i === 'b');
    expect(hand).toEqual(['a', 'b']);
  });
});
