import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeStats } from '@cinecards/engine';
import { act, card, MVP, scene } from '../../../../packages/engine/src/scenario.ts';
import { shownView } from './present.ts';
import { Playback } from './playback.ts';

/** Topper Harley (150 ATQ) attacks the Knights who say "Ni!" (150 PV, 70 ATQ): they die, Topper takes the riposte. */
const killScene = () => {
  const { state, id } = scene({ chars: ['hs-topper'] }, { chars: ['hg-ni', 'hg-black-knight'] });
  const topper = id('hs-topper');
  const ni = id('hg-ni');
  const r = act(state, { type: 'attack', player: 0, attacker: topper, target: card(ni) });
  return { before: state, after: r.state, events: r.events, topper, ni };
};

describe('12.1 shown state', () => {
  it('moves forward event by event and ends exactly on the engine state', () => {
    const { before, after, events, topper, ni } = killScene();
    const kill = events.findIndex((e) => e.type === 'cardDestroyed');
    const hit = events.findIndex((e) => e.type === 'damageDealt' && e.target === ni);
    expect(kill).toBeGreaterThan(hit);
    expect(after.players[1].characters).not.toContain(ni);

    // before the hit: the target is in its slot with its full hp
    const v0 = shownView(MVP, before, after, events, hit);
    expect(v0.state.players[1].characters[0]).toBe(ni);
    expect(v0.stats[ni]!.hp).toBe(150);
    expect(v0.stats[topper]!.hp).toBe(computeStats(MVP, before, topper).hp);

    // hit played: hp shows 0, the card is still there
    const v1 = shownView(MVP, before, after, events, hit + 1);
    expect(v1.stats[ni]!.hp).toBe(0);
    expect(v1.state.players[1].characters[0]).toBe(ni);

    // death played and still animating: the card stays in its slot
    const v2 = shownView(MVP, before, after, events, kill + 1, new Set([ni]));
    expect(v2.state.players[1].characters[0]).toBe(ni);
    expect(v2.dying.has(ni)).toBe(true);

    // death animation over: the slot is empty
    const v3 = shownView(MVP, before, after, events, kill + 1);
    expect(v3.state.players[1].characters[0]).toBeNull();

    // everything played: exactly the engine's state
    expect(shownView(MVP, before, after, events, events.length).state).toBe(after);
  });

  it('a played card appears on its beat, not before', () => {
    const { state, id } = scene({ hand: ['mx-tank'] }, {});
    const tank = id('mx-tank');
    const r = act(state, { type: 'playCard', player: 0, iid: tank, slot: 1 });
    const at = r.events.findIndex((e) => e.type === 'cardPlayed');
    expect(shownView(MVP, state, r.state, r.events, at).state.players[0].characters[1]).toBeNull();
    expect(shownView(MVP, state, r.state, r.events, at + 1).state.players[0].characters[1]).toBe(tank);
  });

  it('a hit on the player counts down on its beat', () => {
    const { state, id } = scene({ chars: ['hs-topper'] }, {});
    const r = act(state, { type: 'attack', player: 0, attacker: id('hs-topper'), target: { kind: 'player', player: 1 } });
    const at = r.events.findIndex((e) => e.type === 'playerDamaged');
    expect(shownView(MVP, state, r.state, r.events, at).state.players[1].hp).toBe(state.players[1].hp);
    expect(shownView(MVP, state, r.state, r.events, at + 1).state.players[1].hp).toBe(r.state.players[1].hp);
  });
});

describe('12.1 playback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a destroyed card in its slot until its death animation ends', () => {
    const { before, after, events, ni } = killScene();
    const pb = new Playback(MVP, before, 'normal');
    const order: string[] = [];
    pb.onCue = (c) => order.push(c.beat.event.type);
    pb.push(before, after, events);
    expect(pb.get().state.players[1].characters[0]).toBe(ni);
    let sawDying = false;
    for (let t = 0; t < 10_000 && pb.playing; t += 20) {
      vi.advanceTimersByTime(20);
      if (pb.get().dying.has(ni)) {
        sawDying = true;
        expect(pb.get().state.players[1].characters[0]).toBe(ni);
      }
    }
    expect(sawDying).toBe(true);
    expect(pb.get().state).toBe(after);
    expect(order.indexOf('attackDeclared')).toBeLessThan(order.indexOf('damageDealt'));
    expect(order.indexOf('damageDealt')).toBeLessThan(order.indexOf('cardDestroyed'));
  });

  it('instant speed lands on the engine state at once; hurry and flush shorten playback', () => {
    const { before, after, events } = killScene();
    const instant = new Playback(MVP, before, 'instant');
    instant.push(before, after, events);
    expect(instant.get().state).toBe(after);
    expect(instant.playing).toBe(false);

    const normal = new Playback(MVP, before, 'normal');
    normal.push(before, after, events);
    const full = normal.busyFor();
    normal.hurry();
    expect(normal.busyFor()).toBeLessThan(full);
    normal.flush();
    expect(normal.get().state).toBe(after);
  });

  it('acting hurries what was queued, not the batch the action brings', () => {
    const { before, after, events } = killScene();
    const pb = new Playback(MVP, before, 'normal');
    const rates: number[] = [];
    pb.onCue = (c) => rates.push(c.rate);
    pb.push(before, after, events);
    pb.hurry();
    pb.push(after, after, [{ type: 'turnEnded', player: 0 }, { type: 'turnStarted', player: 1, turnNumber: 4 }]);
    vi.advanceTimersByTime(10_000);
    expect(rates[1]).toBe(0.25);
    expect(rates.at(-1)).toBe(1);
  });

  it('pauses (hot-seat hand-over) and resumes', () => {
    const { before, after, events } = killScene();
    const pb = new Playback(MVP, before, 'fast');
    pb.pause(true);
    pb.push(before, after, events);
    vi.advanceTimersByTime(5000);
    expect(pb.get().state).not.toBe(after);
    pb.pause(false);
    vi.advanceTimersByTime(5000);
    expect(pb.get().state).toBe(after);
  });
});
