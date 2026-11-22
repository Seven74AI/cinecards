import { describe, expect, it } from 'vitest';
import { apply, computeStats, cycleCountdown } from './index.ts';
import { char, put, setup, spell } from './test-utils.ts';
import type { Card } from '@cinecards/cards';
import type { Action, Catalog, GameState } from './types.ts';

const ab = (kind: string, effects: unknown[], name = 'a') => ({ name, kind, text: '', power: { icon: 'bolt', count: 1 }, effects }) as unknown as Card['abilities'][number];
function ok(catalog: Catalog, state: GameState, action: Action) {
  const r = apply(catalog, state, action);
  if (!r.ok) throw new Error(r.error.code);
  return r;
}

describe('3.1 effect runner', () => {
  it('runs a spell effect list in order and stops a runaway chain', () => {
    // two characters that heal each other on every heal would loop; the chain cap stops it
    const loopA = char('loopA', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'damage', target: 'allEnemies', amount: 10 }, { op: 'damage', target: 'allEnemies', amount: 10 }])] });
    const foe = char('foe', 1, 100, 10);
    const { catalog, state } = setup([loopA, foe, ...Array.from({ length: 20 }, (_, i) => spell('f' + i, 1))]);
    const a = put(state, 'loopA', 0, 'hand');
    const f = put(state, 'foe', 1, 'characters');
    state.players[0].coins = 5;
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: a });
    expect(computeStats(catalog, r.state, f).hp).toBe(80);
  });
});

describe('3.4 auras are recomputed and vanish with their source', () => {
  it('a terrain aura applies only while the terrain is on the table', () => {
    const terr = { ...spell('terr', 1, 'terrain'), abilities: [ab('passive', [{ op: 'aura', who: 'allies', atk: 20 }])] } as Card;
    const c = char('c', 1, 100, 30);
    const { catalog, state } = setup([terr, c]);
    const ci = put(state, 'c', 0, 'characters');
    const t = put(state, 'terr', 0, 'hand');
    state.players[0].coins = 5;
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: t });
    expect(computeStats(catalog, r.state, ci).atk).toBe(50);
    r.state.players[0].terrains = r.state.players[0].terrains.map(() => null);
    expect(computeStats(catalog, r.state, ci).atk).toBe(30);
  });
});

describe('3.5 statuses', () => {
  it('a shield absorbs damage before PV; poison ticks at the start of its owner turn', () => {
    const c = char('c', 1, 100, 10);
    const foe = char('foe', 1, 100, 50);
    const { catalog, state } = setup([c, foe, ...Array.from({ length: 20 }, (_, i) => spell('f' + i, 1))]);
    const ci = put(state, 'c', 1, 'characters');
    const fi = put(state, 'foe', 0, 'characters');
    state.instances[ci]!.statuses.push({ kind: 'shield', amount: 40, source: 'x' }, { kind: 'poison', amount: 10, source: 'x' });
    let r = ok(catalog, state, { type: 'attack', player: 0, attacker: fi, target: { kind: 'card', iid: ci } });
    expect(computeStats(catalog, r.state, ci).hp).toBe(90);
    r = ok(catalog, r.state, { type: 'endTurn', player: 0 });
    expect(computeStats(catalog, r.state, ci).hp).toBe(80);
  });
});

describe('3.8 cycles', () => {
  it('"every 2 turns" is first active 2 owner-turns after arrival', () => {
    const c = char('c', 1, 100, 10, { abilities: [ab('passive', [{ op: 'cycleAtkDouble', every: 2 }])] });
    const { catalog, state } = setup([c]);
    const ci = put(state, 'c', 0, 'characters', 0, 1);
    state.players[0].turnNumber = 2;
    expect(cycleCountdown(catalog, state, ci)).toBe(1);
    state.players[0].turnNumber = 3;
    expect(cycleCountdown(catalog, state, ci)).toBe(0);
  });
});

describe('3.10 reaction window', () => {
  it('a player protected by characters cannot be attacked', () => {
    const neo = char('neo', 1, 500, 100, { abilities: [ab('reaction', [{ op: 'counterAttack' }])] });
    const att = char('att', 1, 500, 10);
    const { catalog, state } = setup([neo, att, ...Array.from({ length: 20 }, (_, i) => spell('f' + i, 1))]);
    put(state, 'neo', 1, 'characters');
    const a = put(state, 'att', 0, 'characters');
    expect(apply(catalog, state, { type: 'attack', player: 0, attacker: a, target: { kind: 'player', player: 1 } })).toMatchObject({ ok: false, error: { code: 'TARGET_PROTECTED' } });
  });

  it('pass closes the window', () => {
    const neo = char('neo', 1, 500, 100, { abilities: [ab('reaction', [{ op: 'counterAttack' }])] });
    const att = char('att', 1, 500, 10);
    const { catalog, state } = setup([neo, att, ...Array.from({ length: 20 }, (_, i) => spell('f' + i, 1))]);
    const n = put(state, 'neo', 1, 'characters');
    const a = put(state, 'att', 0, 'characters');
    let r = ok(catalog, state, { type: 'attack', player: 0, attacker: a, target: { kind: 'card', iid: n } });
    expect(r.state.pending?.kind).toBe('reaction');
    expect(apply(catalog, r.state, { type: 'endTurn', player: 0 })).toMatchObject({ ok: false, error: { code: 'PENDING_DECISION' } });
    r = ok(catalog, r.state, { type: 'pass', player: 1 });
    expect(r.state.pending).toBeFalsy();
    r = ok(catalog, r.state, { type: 'endTurn', player: 0 });
    expect(r.state.active).toBe(1);
  });
});
