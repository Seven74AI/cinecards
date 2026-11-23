import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, card, MVP, scene } from '../../../../packages/engine/src/scenario.ts';
import { Playback, type Cue } from './playback.ts';

/** Topper Harley attacks the Knights who say "Ni!": attack, hit, riposte, death. */
const killScene = () => {
  const { state, id } = scene({ chars: ['hs-topper'] }, { chars: ['hg-ni', 'hg-black-knight'] });
  const r = act(state, { type: 'attack', player: 0, attacker: id('hs-topper'), target: card(id('hg-ni')) });
  return { before: state, after: r.state, events: r.events, ni: id('hg-ni') };
};

/** Plays the scene and returns when (ms from the push) each beat started; `onCue` may retime. */
function run(onCue: (c: Cue, now: number) => void) {
  const { before, after, events, ni } = killScene();
  const pb = new Playback(MVP, before, 'normal');
  const t0 = performance.now();
  const starts: { type: string; t: number; ms: number }[] = [];
  let heldUntil = 0;
  pb.onCue = (c) => {
    starts.push({ type: c.beat.event.type, t: performance.now() - t0, ms: c.ms });
    onCue(c, performance.now() - t0);
  };
  pb.push(before, after, events);
  for (let t = 0; t < 20_000 && pb.playing; t += 10) {
    vi.advanceTimersByTime(10);
    if (pb.get().dying.has(ni)) heldUntil = performance.now() - t0;
  }
  return { starts, heldUntil, pb };
}

describe('story 13.13: a beat retimed to the travel the director measured', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('without retime, the next beat starts after the planned gap', () => {
    const { starts } = run(() => {});
    const att = starts.find((s) => s.type === 'attackDeclared')!;
    const hit = starts.find((s) => s.type === 'damageDealt')!;
    expect(hit.t - att.t).toBeGreaterThanOrEqual(att.ms);
    expect(hit.t - att.t).toBeLessThan(att.ms + 20);
  });

  it('a retime during the cue moves the next beat', () => {
    const { starts } = run((c) => {
      if (c.beat.event.type === 'attackDeclared') c.retime?.(900);
    });
    const att = starts.find((s) => s.type === 'attackDeclared')!;
    const hit = starts.find((s) => s.type === 'damageDealt')!;
    expect(hit.t - att.t).toBeGreaterThanOrEqual(900);
    expect(hit.t - att.t).toBeLessThan(920);
  });

  it('a retime a frame later counts from the beat start', () => {
    const { starts } = run((c) => {
      if (c.beat.event.type === 'attackDeclared') setTimeout(() => c.retime?.(200), 16);
    });
    const att = starts.find((s) => s.type === 'attackDeclared')!;
    const hit = starts.find((s) => s.type === 'damageDealt')!;
    expect(hit.t - att.t).toBeGreaterThanOrEqual(200);
    expect(hit.t - att.t).toBeLessThan(220);
  });

  it('a dying card stays in its slot until its retimed end, and a stale retime is ignored', () => {
    let stale: Cue | null = null;
    let deathAt = 0;
    const { starts, heldUntil, pb } = run((c, now) => {
      if (c.beat.event.type === 'attackDeclared') stale = c;
      if (c.beat.event.type === 'cardDestroyed') {
        deathAt = now;
        c.retime?.(2000);
        stale?.retime?.(50);
      }
    });
    expect(starts.some((s) => s.type === 'cardDestroyed')).toBe(true);
    expect(heldUntil - deathAt).toBeGreaterThanOrEqual(1980);
    expect(pb.playing).toBe(false);
  });
});
