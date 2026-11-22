import { describe, expect, it } from 'vitest';
import type { Ability, Card } from '@cinecards/cards';
import { apply, botRandom, botStep, timeoutAction, unsupportedReason, type Action, type Catalog, type GameState } from './index.ts';
import { char, put, setup } from './test-utils.ts';

const power = { icon: 'bolt' as const, count: 1 };
const ab = (kind: string, effects: Ability['effects'], extra: Partial<Ability> = {}): Ability => ({ name: `${kind}!`, power, kind, text: kind, effects, ...extra }) as Ability;

function ok(catalog: Catalog, state: GameState, action: Action) {
  const r = apply(catalog, state, action);
  if (!r.ok) throw new Error(`unexpected ${r.error.code}`);
  return r;
}
const refused = (catalog: Catalog, state: GameState, action: Action) => {
  const r = apply(catalog, state, action);
  return r.ok ? null : r.error.code;
};

describe('11.4 triggered abilities', () => {
  it('an onPlay effect with a chosen target asks its player when the card arrives, and the journal names the trigger', () => {
    const tim = char('tim', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'damage', target: 'chosenEnemy', amount: 50 }])] });
    const { catalog, state } = setup([tim, char('foe', 1, 100, 10), char('foe2', 1, 100, 10)]);
    const t = put(state, 'tim', 0, 'hand');
    const f = put(state, 'foe', 1, 'characters', 0, 1);
    put(state, 'foe2', 1, 'characters', 1, 1);
    state.players[0].coins = 5;
    let r = ok(catalog, state, { type: 'playCard', player: 0, iid: t });
    expect(r.state.pending).toMatchObject({ kind: 'targets', player: 0, source: t, trigger: 'onPlay', requests: [{ spec: 'chosenEnemy', count: 1 }] });
    expect(r.state.instances[f]!.damage).toBe(0);
    expect(refused(catalog, r.state, { type: 'endTurn', player: 0 })).toBe('PENDING_DECISION');
    r = ok(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[f]] });
    expect(r.state.pending).toBeNull();
    expect(r.state.instances[f]!.damage).toBe(50);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'abilityUsed', iid: t, trigger: 'onPlay' }));
  });

  it('targets declared with the action are used as given (older clients)', () => {
    const tim = char('tim', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'damage', target: 'chosenEnemy', amount: 50 }])] });
    const { catalog, state } = setup([tim, char('foe', 1, 100, 10), char('foe2', 1, 100, 10)]);
    const t = put(state, 'tim', 0, 'hand');
    put(state, 'foe', 1, 'characters', 0, 1);
    const f2 = put(state, 'foe2', 1, 'characters', 1, 1);
    state.players[0].coins = 5;
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: t, targets: [{ kind: 'card', iid: f2 }] });
    expect(r.state.pending).toBeNull();
    expect(r.state.instances[f2]!.damage).toBe(50);
  });

  it('onAllyPlayed and onEnemyPlayed wake on another card being played, with a filter', () => {
    const scout = char('scout', 1, 100, 10, { abilities: [ab('onAllyPlayed', [{ op: 'modify', target: 'self', atk: 10 }], { filter: { set: 'test' } })] });
    const spy = char('spy', 1, 100, 10, { abilities: [ab('onEnemyPlayed', [{ op: 'modify', target: 'self', hp: 20 }])] });
    const other = char('other', 1, 100, 10, { set: 'elsewhere' });
    const { catalog, state } = setup([scout, spy, char('rookie', 1, 100, 10), other]);
    const s = put(state, 'scout', 0, 'characters', 0, 1);
    const sp = put(state, 'spy', 1, 'characters', 0, 1);
    const rookie = put(state, 'rookie', 0, 'hand');
    const o = put(state, 'other', 0, 'hand');
    state.players[0].coins = 5;
    let r = ok(catalog, state, { type: 'playCard', player: 0, iid: rookie });
    expect(r.state.instances[s]!.modifiers).toHaveLength(1);
    expect(r.state.instances[sp]!.modifiers).toHaveLength(1);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'abilityUsed', iid: s, trigger: 'onAllyPlayed' }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'abilityUsed', iid: sp, trigger: 'onEnemyPlayed' }));
    r = ok(catalog, r.state, { type: 'playCard', player: 0, iid: o });
    expect(r.state.instances[s]!.modifiers).toHaveLength(1); // filtered out: not a "test" card
    expect(r.state.instances[sp]!.modifiers).toHaveLength(2);
  });

  it('start and end of turn triggers fire for their owner only; silence stops them', () => {
    const clock = char('clock', 1, 100, 10, { abilities: [ab('startOfTurn', [{ op: 'modify', target: 'self', atk: 10 }]), ab('endOfTurn', [{ op: 'modify', target: 'self', hp: 10 }])] });
    const { catalog, state } = setup([clock]);
    const c = put(state, 'clock', 0, 'characters', 0, 1);
    let r = ok(catalog, state, { type: 'endTurn', player: 0 });
    expect(r.state.instances[c]!.modifiers.map((m) => m.hp)).toEqual([10]); // end of my turn
    expect(r.events.findIndex((e) => e.type === 'abilityUsed')).toBeLessThan(r.events.findIndex((e) => e.type === 'turnEnded'));
    r = ok(catalog, r.state, { type: 'endTurn', player: 1 }); // opponent's turn: nothing; then my start of turn
    expect(r.state.instances[c]!.modifiers.map((m) => m.atk)).toEqual([0, 10]);
    r.state.instances[c]!.statuses.push({ kind: 'silence', turnsLeft: 5, source: 'x' });
    r = ok(catalog, r.state, { type: 'endTurn', player: 0 });
    expect(r.state.instances[c]!.modifiers).toHaveLength(2);
  });

  it('an end-of-turn choice is asked before the turn passes', () => {
    const clock = char('clock', 1, 100, 10, { abilities: [ab('endOfTurn', [{ op: 'damage', target: 'chosenEnemy', amount: 10 }])] });
    const { catalog, state } = setup([clock, char('foe', 1, 100, 10)]);
    put(state, 'clock', 0, 'characters', 0, 1);
    const f = put(state, 'foe', 1, 'characters', 0, 1);
    let r = ok(catalog, state, { type: 'endTurn', player: 0 });
    expect(r.state.active).toBe(0);
    expect(r.state.pending).toMatchObject({ kind: 'targets', trigger: 'endOfTurn' });
    r = ok(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[f]] });
    expect(r.state.instances[f]!.damage).toBe(10);
    expect(r.state.active).toBe(1);
    expect(r.state.players[1].turnNumber).toBe(2);
  });

  it('onDeath with a choice prompts the owner, even outside their turn', () => {
    const martyr = char('martyr', 1, 10, 10, { abilities: [ab('onDeath', [{ op: 'damage', target: 'chosenEnemy', amount: 30 }])] });
    const { catalog, state } = setup([martyr, char('brute', 1, 100, 50)]);
    const m = put(state, 'martyr', 1, 'characters', 0, 1);
    const b = put(state, 'brute', 0, 'characters', 0, 0);
    let r = ok(catalog, state, { type: 'attack', player: 0, attacker: b, target: { kind: 'card', iid: m } });
    expect(r.state.pending).toMatchObject({ kind: 'targets', player: 1, trigger: 'onDeath', requests: [{ options: [b] }] });
    expect(refused(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[b]] })).toBe('PENDING_DECISION');
    r = ok(catalog, r.state, { type: 'chooseTargets', player: 1, targets: [[b]] });
    expect(r.state.instances[b]!.damage).toBe(10 + 30);
  });

  it('a choose-one onPlay asks for the option at arrival', () => {
    const angel = char('angel', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'chooseOne', options: [[{ op: 'coinBonus', amount: 3 }], [{ op: 'playFree' }]] }])] });
    const { catalog, state } = setup([angel]);
    const a = put(state, 'angel', 0, 'hand');
    state.players[0].coins = 5;
    let r = ok(catalog, state, { type: 'playCard', player: 0, iid: a });
    expect(r.state.pending).toMatchObject({ kind: 'option', choices: 2 });
    expect(refused(catalog, r.state, { type: 'chooseOption', player: 0, option: 2 })).toBe('INVALID_CHOICE');
    r = ok(catalog, r.state, { type: 'chooseOption', player: 0, option: 1 });
    expect(r.state.players[0].freePlay).toBe(true);
  });
});

describe('11.4 attack abilities', () => {
  const ni = char('ni', 1, 100, 10, { abilities: [ab('attack', [{ op: 'status', target: 'chosenEnemy', status: 'silence', turns: 1 }])] });

  it('replaces the attack: not on the turn it arrives, once per turn, and no normal attack afterwards', () => {
    const { catalog, state } = setup([ni, char('foe', 1, 100, 10)]);
    const n = put(state, 'ni', 0, 'characters', 0, 1);
    const f = put(state, 'foe', 1, 'characters', 0, 1);
    state.instances[n]!.playedOnTurn = 1;
    expect(refused(catalog, state, { type: 'useAbility', player: 0, iid: n, ability: 0 })).toBe('SUMMONING_SICK');
    state.instances[n]!.playedOnTurn = 0;
    let r = ok(catalog, state, { type: 'useAbility', player: 0, iid: n, ability: 0 });
    r = ok(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[f]] });
    expect(r.state.instances[f]!.statuses[0]).toMatchObject({ kind: 'silence' });
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'abilityUsed', trigger: 'attack' }));
    expect(refused(catalog, r.state, { type: 'useAbility', player: 0, iid: n, ability: 0 })).toBe('ABILITY_USED');
    expect(refused(catalog, r.state, { type: 'attack', player: 0, attacker: n, target: { kind: 'card', iid: f } })).toBe('NO_ATTACK_LEFT');
    // next turn it is available again
    r = ok(catalog, r.state, { type: 'endTurn', player: 0 });
    r = ok(catalog, r.state, { type: 'endTurn', player: 1 });
    expect(refused(catalog, r.state, { type: 'useAbility', player: 0, iid: n, ability: 0 })).toBeNull();
  });

  it('cannot be used after a normal attack, and haste allows it on arrival', () => {
    const hasty = char('hasty', 1, 100, 10, { abilities: [ab('passive', [{ op: 'haste' }]), ab('attack', [{ op: 'modify', target: 'self', atk: 10 }])] });
    const { catalog, state } = setup([ni, hasty, char('foe', 1, 100, 10)]);
    const n = put(state, 'ni', 0, 'characters', 0, 0);
    const h = put(state, 'hasty', 0, 'characters', 1, 1);
    const f = put(state, 'foe', 1, 'characters', 0, 1);
    const r = ok(catalog, state, { type: 'attack', player: 0, attacker: n, target: { kind: 'card', iid: f } });
    expect(refused(catalog, r.state, { type: 'useAbility', player: 0, iid: n, ability: 0 })).toBe('NO_ATTACK_LEFT');
    expect(refused(catalog, r.state, { type: 'useAbility', player: 0, iid: h, ability: 1 })).toBeNull();
  });
});

describe('11.4 support and bots', () => {
  it('support refuses an unknown trigger', () => {
    const weird = char('weird', 1, 100, 10, { abilities: [ab('onFullMoon', [{ op: 'none' }])] }) as Card;
    expect(unsupportedReason(weird)).toMatch(/unknown trigger "onFullMoon"/);
    expect(unsupportedReason(char('fine', 1, 100, 10, { abilities: [ab('endOfTurn', [{ op: 'none' }])] }))).toBeNull();
  });

  it('the bot answers target and option prompts', () => {
    const tim = char('tim', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'damage', target: 'chosenEnemy', amount: 50 }])] });
    const { catalog, state } = setup([tim, char('foe', 1, 100, 10)]);
    const t = put(state, 'tim', 0, 'hand');
    put(state, 'foe', 1, 'characters', 0, 1);
    state.players[0].coins = 5;
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: t });
    const step = botStep(catalog, r.state, 0, botRandom(1));
    expect(step?.action.type).toBe('chooseTargets');
    expect(step?.state.pending).toBeNull();
  });
});

describe('11.5 choose from 0 to N targets', () => {
  const tank = char('tank', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'returnToHand', target: 'chosenCard', count: 3 }])] });
  const sniper = char('sniper', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'damage', target: 'chosenEnemy', count: 2, exactly: true, amount: 10 }])] });
  const keeper = char('keeper', 1, 100, 10, { abilities: [ab('onPlay', [{ op: 'lookAndPick', look: 4, pick: 2 }])] });
  const cards = [tank, sniper, keeper, char('a', 1, 100, 10), char('b', 1, 100, 10), char('c', 1, 100, 10), char('d', 1, 100, 10), char('e', 1, 100, 10)];

  function table() {
    const { catalog, state } = setup(cards);
    const foes = ['a', 'b', 'c'].map((c, i) => put(state, c, 1, 'characters', i, 1));
    state.players[0].coins = 10;
    return { catalog, state, foes };
  }

  it('"choose 3" accepts 0 to 3 picks, and refuses more', () => {
    const { catalog, state, foes } = table();
    const t = put(state, 'tank', 0, 'hand');
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: t });
    expect(r.state.pending).toMatchObject({ kind: 'targets', requests: [{ count: 3, min: 0 }] });
    expect(refused(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[...foes, t]] })).toBe('INVALID_CHOICE');
    const none = ok(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[]] });
    expect(none.state.players[1].characters.filter(Boolean)).toHaveLength(3);
    const one = ok(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[foes[1]!]] });
    expect(one.state.players[1].hand).toEqual([foes[1]]);
  });

  it('"exactly N" requires N picks', () => {
    const { catalog, state, foes } = table();
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: put(state, 'sniper', 0, 'hand') });
    expect(r.state.pending).toMatchObject({ requests: [{ count: 2, min: 2 }] });
    expect(refused(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[foes[0]!]] })).toBe('INVALID_CHOICE');
    expect(ok(catalog, r.state, { type: 'chooseTargets', player: 0, targets: [[foes[0]!, foes[2]!]] }).state.instances[foes[2]!]!.damage).toBe(10);
  });

  it('declared targets are never completed at random', () => {
    const { catalog, state, foes } = table();
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: put(state, 'tank', 0, 'hand'), targets: [{ kind: 'card', iid: foes[0]! }] });
    expect(r.state.players[1].hand).toEqual([foes[0]]);
  });

  it('the timer default for "up to N" is no target', () => {
    const { catalog, state } = table();
    const r = ok(catalog, state, { type: 'playCard', player: 0, iid: put(state, 'tank', 0, 'hand') });
    expect(timeoutAction(r.state)).toEqual({ type: 'chooseTargets', player: 0, targets: [[]] });
    expect(ok(catalog, r.state, timeoutAction(r.state)!).state.players[1].characters.filter(Boolean)).toHaveLength(3);
  });

  it('deck picks accept 0 to N cards too', () => {
    const { catalog, state } = table();
    let r = ok(catalog, state, { type: 'playCard', player: 0, iid: put(state, 'keeper', 0, 'hand') });
    expect(r.state.pending).toMatchObject({ kind: 'pick', count: 2, min: 0 });
    const opts = r.state.pending!.kind === 'pick' ? r.state.pending.options : [];
    expect(refused(catalog, r.state, { type: 'choose', player: 0, picks: opts.slice(0, 3) })).toBe('INVALID_CHOICE');
    r = ok(catalog, r.state, { type: 'choose', player: 0, picks: [opts[1]!] });
    expect(r.state.players[0].hand).toEqual([opts[1]]);
  });
});
