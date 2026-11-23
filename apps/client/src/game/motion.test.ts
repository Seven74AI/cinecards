import { describe, expect, it } from 'vitest';
import { FX_MIN_FONT, fxScale, shakeScale, TRAVEL_BOUNDS, TRAVEL_REF, travelFactor } from './motion.ts';

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

describe('story 13.14: effects at the scale of the card', () => {
  it('is the width over the demo card (100 px), bounded by 0.45 and 1.3', () => {
    expect(fxScale(100)).toBe(1);
    expect(fxScale(59)).toBeCloseTo(0.59);
    expect(fxScale(104)).toBeCloseTo(1.04);
    expect(fxScale(20)).toBe(0.45);
    expect(fxScale(400)).toBe(1.3);
    expect(fxScale(0)).toBe(1);
    expect(FX_MIN_FONT).toBe(11);
  });
});

describe('story 13.15: the shake follows the screen', () => {
  it('keeps the demo on a 390 px phone and goes up to twice on a desktop', () => {
    expect(shakeScale(390, 844)).toBe(1);
    expect(shakeScale(360, 640)).toBeCloseTo(360 / 390);
    expect(shakeScale(1440, 900)).toBe(2);
    expect(shakeScale(1280, 720)).toBe(720 / 390 > 2 ? 2 : 720 / 390);
    expect(shakeScale(100, 100)).toBe(0.4);
    expect(shakeScale(0, 800)).toBe(1);
  });
});
