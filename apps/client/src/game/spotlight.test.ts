import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply, botRandom, botStep, type GameEvent, type GameState } from '@cinecards/engine';
import { CATALOG } from './catalog.ts';
import { devScene, devBotSeed } from './devscene.ts';
import { planBeats, REMOVAL, SPOT_MS } from './fx.ts';
import { Playback, type Cue } from './playback.ts';
import { removalAt, removalText } from './removal.ts';

/** Story 13.10: the dev scene `retrait`, played like the table does: I end my turn, Le Grimoire plays Tank. */
function foeTurn() {
  let s = devScene(CATALOG, 'retrait')!;
  const batches: { before: GameState; after: GameState; events: GameEvent[] }[] = [];
  const r0 = apply(CATALOG, s, { type: 'endTurn', player: 0 });
  if (!r0.ok) throw new Error('endTurn');
  batches.push({ before: s, after: r0.state, events: r0.events });
  s = r0.state;
  const rnd = botRandom(devBotSeed('retrait')! ^ 0x5bd1e995);
  for (let k = 0; k < 6 && (s.active === 1 || s.pending?.player === 1); k++) {
    const st = botStep(CATALOG, s, 1, rnd);
    if (!st) break;
    const r = apply(CATALOG, s, st.action);
    if (!r.ok) break;
    batches.push({ before: s, after: r.state, events: r.events });
    s = r.state;
  }
  return batches;
}

describe('13.10 spotlight and removal beats', () => {
  it('a card with an "À l\'arrivée" effect or a spell gets a spotlight; a plain character does not', () => {
    const batches = foeTurn();
    const all = batches.flatMap((b) => b.events);
    const beats = planBeats(all, CATALOG, { alertFor: [0] });
    const tank = beats.find((b) => b.event.type === 'cardPlayed' && b.event.cardId === 'mx-tank')!;
    expect(tank.spot).toMatchObject({ cardId: 'mx-tank', player: 1, ability: 0 });
    expect(tank.lead).toBe(SPOT_MS);
    const spell = planBeats([{ type: 'cardPlayed', player: 0, iid: 'x', cardId: 'hs-missile', zone: 'resolved', cost: 7 }], CATALOG)[0]!;
    expect(spell.spot?.cardId).toBe('hs-missile');
    const plain = planBeats([{ type: 'cardPlayed', player: 0, iid: 'x', cardId: 'hs-topper', zone: 'character', slot: 0, cost: 9 }], CATALOG)[0]!;
    expect(plain.spot).toBeUndefined();
    expect(plain.lead).toBeUndefined();
  });

  it('my card sent back by the foe\'s Tank gets the stamp and the alert, named with the ability and its source', () => {
    const all = foeTurn().flatMap((b) => b.events);
    const i = all.findIndex((e) => e.type === 'returnedToHand');
    const r = removalAt(all, i)!;
    expect(r).toMatchObject({ kind: 'returned', owner: 0, by: 1 });
    const beats = planBeats(all, CATALOG, { alertFor: [0] });
    expect(beats[i]!.removal?.iid).toBe(r.iid);
    expect(beats[i]!.lead).toBe(REMOVAL.stamp + REMOVAL.hold);
    // the foe's own cards, or nobody watched: no alert
    expect(planBeats(all, CATALOG, { alertFor: [1] })[i]!.removal).toBeUndefined();
    const s = devScene(CATALOG, 'retrait')!;
    const text = removalText(r, CATALOG, (iid) => s.instances[iid]?.cardId, true);
    expect(text.title).toBe('Votre carte a quitté la table');
    expect(text.body).toMatch(/^Sire Lancelot le Brave — renvoyée dans votre main, par « Opérateur \?! .* » \(Tank, adversaire\)\.$/);
  });

  it('a combat death is not a removal by an effect', () => {
    const ev: GameEvent[] = [
      { type: 'abilityUsed', iid: 'a', ability: 0, name: 'X', player: 1 },
      { type: 'attackDeclared', player: 1, attacker: 'b', target: { kind: 'card', iid: 'c' } },
      { type: 'cardDestroyed', iid: 'c', owner: 0 },
    ];
    expect(removalAt(ev, 2)).toBeNull();
    expect(removalAt([ev[0]!, { type: 'summoned', iid: 'c', player: 1, from: 'enemyBoard' }], 1)).toMatchObject({ kind: 'stolen', owner: 0 });
  });
});

describe('13.10 playback leads', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const tankBatch = () => foeTurn().find((b) => b.events.some((e) => e.type === 'cardPlayed'))!;

  it('plays the spotlight before the card, the table still showing the state before it; "rapide" halves it', () => {
    for (const [speed, k] of [['normal', 1], ['fast', 0.5]] as const) {
      const { before, after, events } = tankBatch();
      const pb = new Playback(CATALOG, before, speed);
      const cues: Cue[] = [];
      pb.onCue = (c) => cues.push(c);
      pb.push(before, after, events);
      for (let t = 0; t < 2000 && !cues.some((c) => c.lead); t += 10) vi.advanceTimersByTime(10);
      const lead = cues.find((c) => c.lead)!;
      expect(lead.beat.spot?.cardId).toBe('mx-tank');
      expect(lead.ms).toBe(Math.round(SPOT_MS * k));
      const tank = lead.beat.spot!.iid;
      expect(pb.get().state.players[1].characters).not.toContain(tank);
      vi.advanceTimersByTime(lead.ms - 10);
      expect(cues.at(-1)!.lead).toBe(true);
      vi.advanceTimersByTime(20);
      expect(cues.at(-1)!.beat.event.type).toBe('cardPlayed');
      pb.flush();
    }
  });

  it('a tap ends the spotlight at once; "instantanée" has none', () => {
    const { before, after, events } = tankBatch();
    const pb = new Playback(CATALOG, before, 'normal');
    const cues: Cue[] = [];
    pb.onCue = (c) => cues.push(c);
    pb.push(before, after, events);
    for (let t = 0; t < 2000 && !cues.some((c) => c.lead); t += 10) vi.advanceTimersByTime(10);
    cues.find((c) => c.lead)!.skip!();
    expect(cues.at(-1)!.beat.event.type).toBe('cardPlayed');

    const instant = new Playback(CATALOG, before, 'instant');
    const none: Cue[] = [];
    instant.onCue = (c) => none.push(c);
    instant.push(before, after, events);
    expect(none).toHaveLength(0);
    expect(instant.get().state).toBe(after);
  });
});
