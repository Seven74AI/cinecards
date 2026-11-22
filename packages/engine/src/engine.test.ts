import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { apply, computeStats, createGame, RULES, type Action, type Catalog, type GameState } from './index.ts';
import { catalogOf, char, put, setup, spell } from './test-utils.ts';

const { catalog: MVP } = loadSetsFromDir(fileURLToPath(new URL('../../../content/sets', import.meta.url)));

function ok(state: GameState, action: Action, catalog: Catalog = MVP) {
  const r = apply(catalog, state, action);
  if (!r.ok) throw new Error(`unexpected ${r.error.code}`);
  return r;
}

describe('2.1 create a game and alternate turns', () => {
  it('deals 7 cards each, 700 hp, first player from the seed (+1 draw on turn 1)', () => {
    const { state } = createGame(MVP, { seed: 42 });
    const first = state.firstPlayer;
    expect(state.players[first].hand).toHaveLength(8);
    expect(state.players[1 - first]!.hand).toHaveLength(7);
    expect(state.players.map((p) => p.hp)).toEqual([700, 700]);
    expect(state.sharedDeck).toHaveLength(51 - 15);
    expect(state.active).toBe(first);
  });

  it('is deterministic for a given seed', () => {
    expect(createGame(MVP, { seed: 7 }).state).toEqual(createGame(MVP, { seed: 7 }).state);
    expect(createGame(MVP, { seed: 7 }).state).not.toEqual(createGame(MVP, { seed: 8 }).state);
  });

  it('endTurn passes the turn and increments the turn counter', () => {
    const { state } = createGame(MVP, { seed: 3 });
    const p = state.active;
    const r = ok(state, { type: 'endTurn', player: p });
    expect(r.state.active).toBe(1 - p);
    expect(r.state.players[1 - p]!.turnNumber).toBe(1);
    expect(state.active).toBe(p); // input untouched
  });
});

describe('2.2 coins', () => {
  it('income = turn number, stock kept, capped at 10', () => {
    const { catalog, state } = setup([char('a', 1, 10, 10), char('b', 1, 10, 10)]);
    state.active = 1;
    state.players[0].turnNumber = 2;
    state.players[0].coins = 2;
    let r = ok(state, { type: 'endTurn', player: 1 }, catalog);
    expect(r.state.players[0].coins).toBe(5);
    r.state.players[0].turnNumber = 11;
    r.state.players[0].coins = 9;
    r.state.active = 1;
    r = ok(r.state, { type: 'endTurn', player: 1 }, catalog);
    expect(r.state.players[0].coins).toBe(10);
  });

  it('refuses a card costing more than the stock', () => {
    const { catalog, state } = setup([char('big', 5, 10, 10)]);
    const iid = put(state, 'big', 0, 'hand');
    state.players[0].coins = 4;
    expect(apply(catalog, state, { type: 'playCard', player: 0, iid })).toEqual({ ok: false, error: { code: 'NOT_ENOUGH_COINS', params: { cost: 5, coins: 4 } } });
  });
});

describe('2.3 draw and deck modes', () => {
  it('burns the drawn card when the hand is full', () => {
    const cards = Array.from({ length: 12 }, (_, i) => char(`c${i}`, 1, 10, 10));
    const { catalog, state } = setup(cards);
    for (let i = 0; i < 10; i++) put(state, `c${i}`, 0, 'hand');
    state.active = 1;
    const r = ok(state, { type: 'endTurn', player: 1 }, catalog);
    expect(r.state.players[0].hand).toHaveLength(10);
    expect(r.events.some((e) => e.type === 'cardBurned')).toBe(true);
  });

  it('reshuffles graveyards when the shared deck is empty, and skips the draw when everything is empty', () => {
    const { catalog, state } = setup([char('a', 1, 10, 10), char('b', 1, 10, 10)]);
    const [a, b] = Object.keys(state.instances);
    state.sharedDeck = [];
    state.players[1].graveyard = [a!];
    state.active = 1;
    let r = ok(state, { type: 'endTurn', player: 1 }, catalog);
    expect(r.events.map((e) => e.type)).toContain('deckReshuffled');
    expect(r.state.players[0].hand).toEqual([a]);
    r.state.players[0].hand = [];
    r.state.instances[b!]!.owner = 0;
    r = ok(r.state, { type: 'endTurn', player: 0 }, catalog);
    r = ok(r.state, { type: 'endTurn', player: 1 }, catalog);
    expect(r.events.map((e) => e.type)).toContain('deckEmpty');
  });

  it('randomSplit mode gives each player half of the deck', () => {
    const { state } = createGame(MVP, { seed: 5, mode: 'randomSplit' });
    const total = state.players[0].deck.length + state.players[1].deck.length + 15;
    expect(total).toBe(50); // 51 cards: 25 + 25, one left out
    const f = state.firstPlayer;
    expect(state.players[f].deck).toHaveLength(25 - 8); // 7 dealt + 1 turn-1 draw
    expect(state.players[1 - f]!.deck).toHaveLength(25 - 7);
  });
});

describe('2.4 play cards into slots', () => {
  it('places a character, which cannot attack this turn', () => {
    const { catalog, state } = setup([char('a', 1, 10, 10), char('foe', 1, 10, 10)]);
    const iid = put(state, 'a', 0, 'hand');
    put(state, 'foe', 1, 'characters', 0);
    state.players[0].coins = 1;
    const r = ok(state, { type: 'playCard', player: 0, iid, slot: 3 }, catalog);
    expect(r.state.players[0].characters[3]).toBe(iid);
    expect(r.state.players[0].coins).toBe(0);
    const foe = r.state.players[1].characters[0]!;
    expect(apply(catalog, r.state, { type: 'attack', player: 0, attacker: iid, target: { kind: 'card', iid: foe } })).toMatchObject({ ok: false, error: { code: 'SUMMONING_SICK' } });
  });

  it('refuses an occupied slot and routes terrains, equipment and instant spells', () => {
    const { catalog, state } = setup([char('a', 0, 10, 10), char('b', 0, 10, 10), spell('t', 0, 'terrain'), spell('e', 0, 'equipment'), spell('s', 0)]);
    put(state, 'a', 0, 'characters', 0);
    const b = put(state, 'b', 0, 'hand');
    expect(apply(catalog, state, { type: 'playCard', player: 0, iid: b, slot: 0 })).toMatchObject({ ok: false, error: { code: 'SLOT_OCCUPIED' } });
    const t = put(state, 't', 0, 'hand');
    const e = put(state, 'e', 0, 'hand');
    const s = put(state, 's', 0, 'hand');
    let r = ok(state, { type: 'playCard', player: 0, iid: t }, catalog);
    r = ok(r.state, { type: 'playCard', player: 0, iid: e }, catalog);
    r = ok(r.state, { type: 'playCard', player: 0, iid: s }, catalog);
    expect(r.state.players[0].terrains[0]).toBe(t);
    expect(r.state.players[0].spells[0]).toBe(e);
    expect(r.state.players[0].graveyard).toContain(s);
  });
});

describe('2.5 attack, riposte and victory', () => {
  it('both cards strike simultaneously; the loser goes to the graveyard', () => {
    const { catalog, state } = setup([char('a', 0, 100, 60), char('b', 0, 50, 30)]);
    const a = put(state, 'a', 0, 'characters', 0);
    const b = put(state, 'b', 1, 'characters', 0);
    const r = ok(state, { type: 'attack', player: 0, attacker: a, target: { kind: 'card', iid: b } }, catalog);
    expect(computeStats(catalog, r.state, a).hp).toBe(70);
    expect(r.state.players[1].characters[0]).toBeNull();
    expect(r.state.players[1].graveyard).toContain(b);
  });

  it('protects the player while they have characters; direct hits have no riposte; 0 hp loses', () => {
    const { catalog, state } = setup([char('a', 0, 100, 160), char('b', 0, 50, 30)]);
    const a = put(state, 'a', 0, 'characters', 0);
    put(state, 'b', 1, 'characters', 0);
    expect(apply(catalog, state, { type: 'attack', player: 0, attacker: a, target: { kind: 'player', player: 1 } })).toMatchObject({ ok: false, error: { code: 'TARGET_PROTECTED' } });
    state.players[1].characters[0] = null;
    state.players[1].hp = 150;
    const r = ok(state, { type: 'attack', player: 0, attacker: a, target: { kind: 'player', player: 1 } }, catalog);
    expect(r.state.players[1].hp).toBe(0);
    expect(r.state.winner).toBe(0);
    expect(computeStats(catalog, r.state, a).hp).toBe(100);
    expect(apply(catalog, r.state, { type: 'endTurn', player: 0 })).toMatchObject({ ok: false, error: { code: 'GAME_OVER' } });
  });

  it('allows one attack per turn, and concede ends the game', () => {
    const { catalog, state } = setup([char('a', 0, 100, 10), char('b', 0, 500, 10)]);
    const a = put(state, 'a', 0, 'characters', 0);
    const b = put(state, 'b', 1, 'characters', 0);
    const r = ok(state, { type: 'attack', player: 0, attacker: a, target: { kind: 'card', iid: b } }, catalog);
    expect(apply(catalog, r.state, { type: 'attack', player: 0, attacker: a, target: { kind: 'card', iid: b } })).toMatchObject({ ok: false, error: { code: 'NO_ATTACK_LEFT' } });
    const c = ok(r.state, { type: 'concede', player: 1 }, catalog);
    expect(c.state.winner).toBe(0);
  });

  it('multi-body cards attack once per living body and lose bodies one by one', () => {
    const { catalog, state } = setup([char('sent', 0, [100, 100, 100], [40, 40, 40]), char('foe', 0, 1000, 100)]);
    const s = put(state, 'sent', 0, 'characters', 0);
    const f = put(state, 'foe', 1, 'characters', 0);
    let r = ok(state, { type: 'attack', player: 0, attacker: s, target: { kind: 'card', iid: f } }, catalog);
    let st = computeStats(catalog, r.state, s);
    expect(st.bodies!.map((b) => b.alive)).toEqual([false, true, true]);
    r = ok(r.state, { type: 'attack', player: 0, attacker: s, target: { kind: 'card', iid: f } }, catalog);
    st = computeStats(catalog, r.state, s);
    expect(st.bodies!.filter((b) => b.alive)).toHaveLength(1);
    expect(apply(catalog, r.state, { type: 'attack', player: 0, attacker: s, target: { kind: 'card', iid: f } })).toMatchObject({ ok: false, error: { code: 'NO_ATTACK_LEFT' } });
    expect(computeStats(catalog, r.state, f).hp).toBe(1000 - 80);
  });
});

describe('2.6 derived stats with provenance', () => {
  it('sums modifiers, lists their sources, and drops them when removed', () => {
    const { catalog, state } = setup([char('trinity', 0, 300, 100)]);
    const t = put(state, 'trinity', 0, 'characters', 0);
    state.instances[t]!.modifiers.push({ source: 'c9', label: 'Le p’tit derrière toi c’est l’Mulo', atk: 40, hp: 50 });
    state.instances[t]!.damage = 30;
    const st = computeStats(catalog, state, t);
    expect(st).toMatchObject({ atk: 140, maxHp: 350, hp: 320, baseAtk: 100 });
    expect(st.sources).toEqual([{ source: 'c9', label: expect.any(String), atk: 40, hp: 50 }]);
    state.instances[t]!.modifiers = [];
    expect(computeStats(catalog, state, t).atk).toBe(100);
  });

  it('shields absorb first and damage rounds down to tens', () => {
    const { catalog, state } = setup([char('a', 0, 100, 75), char('b', 0, 200, 0)]);
    const a = put(state, 'a', 0, 'characters', 0);
    const b = put(state, 'b', 1, 'characters', 0);
    state.instances[b]!.statuses.push({ kind: 'shield', amount: 40, source: 'switch' });
    const r = ok(state, { type: 'attack', player: 0, attacker: a, target: { kind: 'card', iid: b } }, catalog);
    expect(r.events.find((e) => e.type === 'damageDealt' && e.target === b)).toMatchObject({ amount: 30, absorbed: 40 });
    expect(computeStats(catalog, r.state, b).hp).toBe(170);
  });
});

describe('2.7 events and replay', () => {
  it('every valid action emits events, and a replay reproduces them exactly', () => {
    const run = () => {
      let { state, events } = createGame(MVP, { seed: 99 });
      const log = [...events];
      for (let i = 0; i < 6; i++) {
        const p = state.active;
        const playable = state.players[p].hand.find((iid) => {
          const c = MVP.get(state.instances[iid]!.cardId)!;
          return c.category === 'character' && (c.cost ?? 0) <= state.players[p].coins;
        });
        if (playable) {
          const r = ok(state, { type: 'playCard', player: p, iid: playable });
          expect(r.events.length).toBeGreaterThan(0);
          log.push(...r.events);
          state = r.state;
        }
        const r = ok(state, { type: 'endTurn', player: p });
        log.push(...r.events);
        state = r.state;
      }
      return log;
    };
    expect(run()).toEqual(run());
  });
});

describe('2.8 typed refusals', () => {
  it('returns codes without throwing and leaves the state unchanged', () => {
    const { state } = createGame(MVP, { seed: 11 });
    const before = JSON.stringify(state);
    const notActive = (1 - state.active) as 0 | 1;
    expect(apply(MVP, state, { type: 'endTurn', player: notActive })).toEqual({ ok: false, error: { code: 'NOT_YOUR_TURN' } });
    expect(apply(MVP, state, { type: 'playCard', player: state.active, iid: 'nope' })).toEqual({ ok: false, error: { code: 'CARD_NOT_IN_HAND' } });
    expect(JSON.stringify(state)).toBe(before);
    expect(RULES.MAX_HAND).toBe(10);
  });
});
