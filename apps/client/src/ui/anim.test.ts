import { describe, expect, it } from 'vitest';
import { EASING, ENTRANCE_MS, ENTRANCE_TOUCH, entranceFrames, motionFrames, PHONE_ENTRANCE_MS, PHONE_TEMPO, stepFrames } from './anim.ts';
import { TIMING } from '../game/fx.ts';

const bezier = /^cubic-bezier\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)$/;

describe('story 13.11: easing palette', () => {
  it('names each curve once, as valid cubic-bezier strings (x in 0..1)', () => {
    for (const [name, v] of Object.entries(EASING)) {
      if (name === 'linear') continue;
      const m = bezier.exec(v);
      expect(m, name).not.toBeNull();
      const [x1, , x2] = [Number(m![1]), Number(m![2]), Number(m![3])];
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
    }
    // anticipation steps back, overshoot goes past its place
    expect(Number(bezier.exec(EASING.anticipate)![2])).toBeLessThan(0);
    expect(Number(bezier.exec(EASING.overshoot)![2])).toBeGreaterThan(1);
  });

  it('the hand → table entrance takes ~850 ms, steps back first and lands with an overshoot', () => {
    expect(ENTRANCE_MS).toBe(850);
    expect(TIMING.play).toBe(ENTRANCE_MS);
    const f = entranceFrames(0, 300, 0.5);
    expect(f.map((k) => k.offset)).toEqual([0, 0.12, 0.58, 0.8, 1]);
    // the step back moves further from the slot (dy grows) and every segment has its own curve
    expect(f[1]!.transform).toContain('310px');
    expect(f.slice(0, -1).every((k) => typeof k.easing === 'string' && k.easing !== 'linear')).toBe(true);
    expect(f[3]!.easing).toBe(EASING.overshoot);
    expect(ENTRANCE_TOUCH).toBeGreaterThan(0.8);
  });

  it('the portrait phone slows travel motions (PHONE_TEMPO) and the hand → table flight (1100 ms), not impacts', async () => {
    const { planBeats } = await import('../game/fx.ts');
    const { CATALOG } = await import('../game/catalog.ts');
    const events = [
      { type: 'cardPlayed', player: 0, iid: 'c1', cardId: 'hg-lancelot', zone: 'character', cost: 5 },
      { type: 'attackDeclared', attacker: 'c1', target: { kind: 'player', player: 1 } },
      { type: 'damageDealt', target: 'c2', source: 'c1', amount: 10, absorbed: 0 },
      { type: 'cardDrawn', player: 0, iid: 'c3' },
      { type: 'returnedToHand', iid: 'c1', owner: 0 },
    ] as unknown as Parameters<typeof planBeats>[0];
    const desk = planBeats(events, CATALOG).map((b) => b.gap);
    const phone = planBeats(events, CATALOG, { phone: true }).map((b) => b.gap);
    expect(PHONE_TEMPO).toBe(1.25);
    expect(desk[0]).toBe(ENTRANCE_MS);
    expect(phone[0]).toBe(PHONE_ENTRANCE_MS);
    expect(phone[1]).toBe(Math.round(TIMING.attack * PHONE_TEMPO));
    expect(phone[2]).toBe(desk[2]); // the impact stays snappy
    expect(phone[3]).toBe(Math.round(TIMING.draw * PHONE_TEMPO));
    expect(phone[4]).toBe(Math.round(TIMING.returned * PHONE_TEMPO));
  });

  it('per-keyframe easing fills the segments that have none; reduce motion keeps only fades', () => {
    const s = stepFrames([{ opacity: 0 }, { opacity: 1, offset: 0.5, easing: EASING.snap }, { opacity: 0 }], EASING.easeIn);
    expect(s.map((k) => k.easing)).toEqual([EASING.easeIn, EASING.snap, undefined]);
    const r = motionFrames(entranceFrames(0, 300, 0.5), true);
    expect(r.every((k) => k.transform === undefined && k.easing === undefined)).toBe(true);
    expect(r.map((k) => k.offset)).toEqual([0, 0.12, 0.58, 0.8, 1]);
  });
});
