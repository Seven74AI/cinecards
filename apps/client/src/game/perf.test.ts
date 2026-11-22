import { describe, expect, it } from 'vitest';
import { fpsStats, fpsWanted, particleBudget, PHONE_FX } from './perf.ts';

describe('13.12 smooth animations on phones', () => {
  it('the ?fps counter shows the average and the lowest frame rate of the last second', () => {
    expect(fpsStats(Array(60).fill(1000 / 60))).toEqual({ avg: 60, min: 60 });
    // 57 smooth frames and one of 50 ms: the average barely moves, the minimum shows the hitch
    const frames = [...Array(57).fill(16.7), 50];
    expect(fpsStats(frames).avg).toBe(Math.round((58 * 1000) / (57 * 16.7 + 50)));
    expect(fpsStats(frames).min).toBe(20);
    expect(fpsStats([])).toEqual({ avg: 0, min: 0 });
  });

  it('the counter shows only with ?fps in the address', () => {
    expect(fpsWanted('?fps')).toBe(true);
    expect(fpsWanted('?scene=mort&fps=1')).toBe(true);
    expect(fpsWanted('?scene=mort')).toBe(false);
    expect(fpsWanted('')).toBe(false);
  });

  it('the portrait phone draws fewer particles at once; other layouts keep the full bursts', () => {
    expect(particleBudget(18, false, 100)).toBe(18);
    expect(particleBudget(18, true, 0)).toBe(PHONE_FX.perBurst);
    expect(particleBudget(4, true, 0)).toBe(4);
    expect(particleBudget(18, true, PHONE_FX.live - 3)).toBe(3);
    expect(particleBudget(18, true, PHONE_FX.live + 5)).toBe(0);
  });
});
