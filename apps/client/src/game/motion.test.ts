import { describe, expect, it } from 'vitest';
import { TRAVEL_BOUNDS, TRAVEL_REF, travelFactor } from './motion.ts';

describe('story 13.13: travel time follows the distance', () => {
  it('keeps the usual time at the reference distance and scales in proportion around it', () => {
    expect(travelFactor(300, 300)).toBe(1);
    expect(travelFactor(330, 300)).toBeCloseTo(1.1);
    expect(travelFactor(240, 300)).toBeCloseTo(0.8);
  });
  it('is bounded by 0.7 and 1.4', () => {
    expect(TRAVEL_BOUNDS).toEqual({ min: 0.7, max: 1.4 });
    expect(travelFactor(10, 300)).toBe(0.7);
    expect(travelFactor(5000, 300)).toBe(1.4);
  });
  it('falls back to the usual time without a distance', () => {
    expect(travelFactor(0, 300)).toBe(1);
    expect(travelFactor(Number.NaN, 300)).toBe(1);
    expect(travelFactor(100, 0)).toBe(1);
  });
  it('has a typical distance for each motion on both layouts', () => {
    for (const layout of [TRAVEL_REF.desk, TRAVEL_REF.phone]) for (const v of Object.values(layout)) expect(v).toBeGreaterThan(100);
  });
});
