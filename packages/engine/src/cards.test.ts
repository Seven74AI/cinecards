import { describe, expect, it } from 'vitest';
import { canAttack as canAttackQ, attacksAllowed, computeStats, cycleCountdown, playableCardIds, unsupportedReason, attackTargets } from './index.ts';
import { act, card, forceDice, MVP, scene, types } from './scenario.ts';

const st = (state: Parameters<typeof computeStats>[1], iid: string) => computeStats(MVP, state, iid);

describe('4.x every MVP card is supported by the engine', () => {
  it('all 51 cards encode only known effects', () => {
    const bad = [...MVP.values()].map((c) => [c.id, unsupportedReason(c)]).filter(([, r]) => r);
    expect(bad).toEqual([]);
    expect(playableCardIds(MVP)).toHaveLength(51);
  });
});

describe('11.6 abilities follow the trigger model', () => {
  const all = [...MVP.values()].flatMap((c) => c.abilities.map((a, index) => ({ c, a, index })));

  it('characters have no repeatable "active" left: arrival effects or attack abilities instead', () => {
    const legacy = all.filter(({ c, a }) => c.category === 'character' && (a.kind === 'active' || a.kind === 'choice')).map(({ c, index }) => `${c.id}:${index}`);
    expect(legacy).toEqual(['hs-topper:1']); // Pilote d'élite: already an attack, every 2 turns (unchanged)
  });

  it('texts announce their trigger: « À l’arrivée » and « Attaque »', () => {
    for (const { c, a } of all) {
      if (a.kind === 'onPlay' && c.category !== 'spell') expect(a.text, c.id).toMatch(/^À l'arrivée/);
      if (a.kind === 'attack') expect(a.text, c.id).toMatch(/^Attaque/);
    }
  });

  it('Patsy grants haste to Arthur; the Sentinels attack is single use; the new triggers are in place', () => {
    expect(MVP.get('hg-patsy')!.abilities[0]!.text).toMatch(/^Tant que Patsy est sur votre table, Arthur a la hâte/);
    const sentinels = MVP.get('mx-sentinels')!.abilities[1]!;
    expect(sentinels.kind).toBe('attack');
    expect(sentinels.effects).toContainEqual({ op: 'oncePerGame' });
    const kinds = Object.fromEntries(all.map(({ c, a, index }) => [`${c.id}:${index}`, a.kind]));
    expect(kinds).toMatchObject({
      'mx-keymaker:0': 'onPlay', 'mx-epok:0': 'onPlay', 'mx-epok:1': 'onPlay', 'mx-mouse:0': 'attack', 'mx-mouse:1': 'onPlay',
      'mx-smith:0': 'onPlay', 'mx-smith:1': 'onPlay', 'mx-tank:0': 'onPlay', 'mx-angel:1': 'onPlay', 'mx-switch:0': 'onPlay',
      'mx-dozer:1': 'onPlay', 'mx-trinity:1': 'onPlay', 'mx-neo:2': 'onPlay', 'mx-cypher:0': 'onPlay', 'wc-kevin:0': 'attack',
      'wc-vandergeld:0': 'attack', 'hg-ni:0': 'attack', 'hs-ramada:0': 'attack', 'hs-benson:0': 'startOfTurn', 'mx-sentinels:2': 'startOfTurn',
      'hs-topper:0': 'onKill', 'hg-bridgekeeper:0': 'onAttacked', 'hg-robin:0': 'onAttacked',
    });
  });

  it('Ramada, Vandergeld and Ni use their ability instead of attacking', () => {
    const { state, id } = scene({ chars: ['hs-ramada', 'hs-topper', 'wc-vandergeld', 'hg-ni'] }, { chars: ['hs-kent'] });
    let r = act(state, { type: 'useAbility', player: 0, iid: id('hs-ramada'), ability: 0 });
    r = act(r.state, { type: 'chooseTargets', player: 0, targets: [[id('hs-topper')]] });
    expect(st(r.state, id('hs-topper')).atk).toBe(190);
    for (const who of ['hs-ramada'] as const) expect(canAttackQ(MVP, r.state, id(who))?.code).toBe('NO_ATTACK_LEFT');
    r = act(r.state, { type: 'useAbility', player: 0, iid: id('wc-vandergeld'), ability: 0, targets: [card(id('hs-kent'))] });
    expect(st(r.state, id('hs-kent')).atk).toBe(60);
    expect(canAttackQ(MVP, r.state, id('wc-vandergeld'))?.code).toBe('NO_ATTACK_LEFT');
    r = act(r.state, { type: 'endTurn', player: 0 });
    expect(st(r.state, id('hs-topper')).atk).toBe(150); // "jusqu'à la fin du tour"
  });
});

describe('4.1 Matrix', () => {
  it('Le maître des clés: on arrival, look at 6 and keep up to 3', () => {
    const { state, id } = scene({ hand: ['mx-keymaker'] });
    const top = state.sharedDeck.slice(0, 6);
    let r = act(state, { type: 'playCard', player: 0, iid: id('mx-keymaker') });
    expect(r.state.pending).toMatchObject({ kind: 'pick', count: 3, min: 0, options: top });
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'abilityUsed', iid: id('mx-keymaker'), trigger: 'onPlay' }));
    r = act(r.state, { type: 'choose', player: 0, picks: top.slice(0, 2) });
    expect(r.state.players[0].hand).toEqual(top.slice(0, 2));
    expect(r.state.sharedDeck.slice(0, 4)).toEqual(top.slice(2));
    expect(() => act(r.state, { type: 'useAbility', player: 0, iid: id('mx-keymaker'), ability: 0 })).toThrow('NO_SUCH_ABILITY');
  });

  it('Epok: on arrival, draw 3 and boost every Matrix card in play +30/+50', () => {
    const { state, id } = scene({ chars: ['mx-tank'], hand: ['mx-epok'] }, { chars: ['mx-cypher', 'hs-kent'] });
    const r = act(state, { type: 'playCard', player: 0, iid: id('mx-epok') });
    expect(r.state.players[0].hand).toHaveLength(3);
    expect(st(r.state, id('mx-tank'))).toMatchObject({ atk: 60, hp: 100 });
    expect(st(r.state, id('mx-cypher'))).toMatchObject({ atk: 100 }); // both sides: "TOUTES les cartes"
    expect(st(r.state, id('hs-kent')).atk).toBe(90);
  });

  it('Les pilules de Morpheus: red pill buffs an ally, blue pill hurts an enemy', () => {
    const { state, id } = scene({ chars: ['mx-tank'], hand: ['mx-pills'] }, { chars: ['hs-kent'] });
    const red = act(state, { type: 'playCard', player: 0, iid: id('mx-pills'), option: 0, targets: [card(id('mx-tank'))] });
    expect(st(red.state, id('mx-tank'))).toMatchObject({ atk: 130, hp: 150 });
    const blue = act(state, { type: 'playCard', player: 0, iid: id('mx-pills'), option: 1, targets: [card(id('hs-kent'))] });
    expect(st(blue.state, id('hs-kent'))).toMatchObject({ atk: 10, hp: 80 });
    expect(blue.state.players[0].graveyard).toContain(id('mx-pills'));
  });

  it('Dozer: +20 ATQ aura while on the table; cleanses allies', () => {
    const { state, id } = scene({ chars: ['mx-tank'], hand: ['mx-dozer'] });
    state.instances[id('mx-tank')]!.statuses.push({ kind: 'silence', turnsLeft: 1, source: 'x' });
    const r = act(state, { type: 'playCard', player: 0, iid: id('mx-dozer') });
    expect(r.state.instances[id('mx-tank')]!.statuses).toEqual([]); // on arrival
    expect(st(r.state, id('mx-tank')).atk).toBe(50);
    expect(st(r.state, id('mx-tank')).sources[0]).toMatchObject({ source: id('mx-dozer'), atk: 20 });
  });

  it('Unité A.P.U: steals Capitaine Iffune from the enemy table with stats ×2, else +100 ATQ', () => {
    const { state, id } = scene({ hand: ['mx-apu'] }, { chars: ['mx-iffune'] });
    const r = act(state, { type: 'playCard', player: 0, iid: id('mx-apu') });
    expect(r.state.players[0].characters[0]).toBe(id('mx-iffune'));
    expect(st(r.state, id('mx-iffune'))).toMatchObject({ atk: 240, hp: 620 });
    expect(r.state.players[0].spells[0]).toBe(id('mx-apu'));
    const s2 = scene({ chars: ['mx-tank'], hand: ['mx-apu'] });
    const r2 = act(s2.state, { type: 'playCard', player: 0, iid: s2.id('mx-apu'), targets: [card(s2.id('mx-tank'))] });
    expect(st(r2.state, s2.id('mx-tank')).atk).toBe(130);
  });

  it("Les sentinelles: absorb the allies' ATQ once per game, instead of attacking", () => {
    const { state, id } = scene({ chars: ['mx-sentinels', 'mx-tank'] }, { chars: ['hs-kent'] });
    let r = act(state, { type: 'useAbility', player: 0, iid: id('mx-sentinels'), ability: 1 });
    expect(st(r.state, id('mx-tank')).atk).toBe(0);
    expect(r.state.instances[id('mx-sentinels')]!.attacksUsed).toBe(1);
    r = act(r.state, { type: 'endTurn', player: 0 });
    r = act(r.state, { type: 'endTurn', player: 1 });
    expect(st(r.state, id('mx-tank')).atk).toBe(0); // until the end of the next turn
    expect(() => act(r.state, { type: 'useAbility', player: 0, iid: id('mx-sentinels'), ability: 1 })).toThrow('ABILITY_USED');
    r = act(r.state, { type: 'endTurn', player: 0 });
    expect(st(r.state, id('mx-tank')).atk).toBe(30);
  });

  it('Les sentinelles: three bodies, re-attack on kill, heal allies each turn', () => {
    const { state, id } = scene({ chars: ['mx-sentinels'] }, { chars: ['hg-patsy', 'hs-dead-meat'] });
    let r = act(state, { type: 'attack', player: 0, attacker: id('mx-sentinels'), target: card(id('hg-patsy')) });
    expect(r.state.instances[id('mx-sentinels')]!.attacksUsed).toBe(0); // kill refunds the attack
    r.state.instances[id('mx-sentinels')]!.bodyDamage = [100, 30, 0];
    r = act(r.state, { type: 'endTurn', player: 0 });
    r = act(r.state, { type: 'endTurn', player: 1 });
    expect(r.state.instances[id('mx-sentinels')]!.bodyDamage).toEqual([50, 0, 0]);
  });

  it('E.M.P: destroys machines and silences every card on the table', () => {
    const { state, id } = scene({ chars: ['mx-tank'], hand: ['mx-emp'] }, { chars: ['mx-smith', 'hs-kent'] });
    const r = act(state, { type: 'playCard', player: 0, iid: id('mx-emp') });
    expect(r.state.players[1].characters).not.toContain(id('mx-smith'));
    expect(r.state.instances[id('hs-kent')]!.statuses.map((s) => s.kind)).toContain('silence');
    expect(r.state.instances[id('mx-tank')]!.statuses.map((s) => s.kind)).toContain('silence');
  });

  it('Switch: 40-point shield for allies, and cancels the death of an ally', () => {
    const { state, id } = scene({ chars: ['mx-tank'], hand: ['mx-switch'] }, { chars: ['hg-rabbit'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('mx-switch') });
    expect(r.state.instances[id('mx-tank')]!.statuses[0]).toMatchObject({ kind: 'shield', amount: 40 });
    r = act(r.state, { type: 'endTurn', player: 0 });
    r = act(r.state, { type: 'attack', player: 1, attacker: id('hg-rabbit'), target: card(id('mx-tank')) });
    expect(types(r.events)).toContain('deathPrevented');
    expect(st(r.state, id('mx-tank')).hp).toBe(10);
  });

  it("L'ange sans ailes: a 3-6 on arrival eliminates an enemy; or play the next card for free", () => {
    const { state, id } = scene({ hand: ['mx-angel'] }, { chars: ['hs-kent'] });
    forceDice(state, 5);
    let r = act(state, { type: 'playCard', player: 0, iid: id('mx-angel'), targets: [card(id('hs-kent'))] });
    expect(r.state.players[1].graveyard).toContain(id('hs-kent'));
    const s2 = scene({ hand: ['mx-angel', 'mx-smith'], coins: MVP.get('mx-angel')!.cost! });
    r = act(s2.state, { type: 'playCard', player: 0, iid: s2.id('mx-angel') });
    expect(r.state.pending).toMatchObject({ kind: 'option', choices: 2, trigger: 'onPlay' });
    r = act(r.state, { type: 'chooseOption', player: 0, option: 1 });
    r = act(r.state, { type: 'playCard', player: 0, iid: s2.id('mx-smith') });
    expect(r.state.players[0].characters).toContain(s2.id('mx-smith'));
  });

  it("Ça pisse tu m'étonnes: cleanses an ally and makes it immune to enemy effects", () => {
    const { state, id } = scene({ chars: ['mx-tank'], hand: ['mx-recharge'], coins: 10 }, { chars: ['hg-ni'] });
    state.players[0].coins = 12;
    state.players[0].bonusCoins = 2;
    state.instances[id('mx-tank')]!.statuses.push({ kind: 'poison', amount: 20, source: 'x' });
    let r = act(state, { type: 'playCard', player: 0, iid: id('mx-recharge'), targets: [card(id('mx-tank'))] });
    expect(r.state.instances[id('mx-tank')]!.statuses.map((s) => s.kind)).toEqual(['immune']);
    r = act(r.state, { type: 'endTurn', player: 0 });
    r = act(r.state, { type: 'useAbility', player: 1, iid: id('hg-ni'), ability: 0, targets: [card(id('mx-tank'))] });
    expect(r.state.instances[id('mx-tank')]!.statuses.map((s) => s.kind)).toEqual(['immune']);
  });

  it('La Matrice: Matrix cards take half damage', () => {
    const { state, id } = scene({ chars: ['hs-kent'] }, { chars: ['mx-tank'], terrains: ['mx-matrix'] });
    state.instances[id('mx-tank')]!.modifiers.push({ source: 't', label: 't', atk: 0, hp: 100 });
    const r = act(state, { type: 'attack', player: 0, attacker: id('hs-kent'), target: card(id('mx-tank')) });
    expect(st(r.state, id('mx-tank')).hp).toBe(150 - 40); // 90 → 45 → rounded down to 40
  });

  it('Capitaine Iffune: +80 ATQ under 100 PV, no riposte every other attack, 80 to enemies on death', () => {
    const { state, id } = scene({ chars: ['mx-iffune'] }, { chars: ['hs-kent', 'hs-washout'] });
    state.instances[id('mx-iffune')]!.damage = 230;
    expect(st(state, id('mx-iffune')).atk).toBe(200);
    let r = act(state, { type: 'attack', player: 0, attacker: id('mx-iffune'), target: card(id('hs-washout')) });
    expect(st(r.state, id('mx-iffune')).hp).toBe(80); // first attack: no riposte
  });

  it('Capitaine Iffune death blast hits every enemy character for 80', () => {
    const { state, id } = scene({ chars: ['hs-topper', 'hs-kent'] }, { chars: ['mx-iffune'] });
    state.instances[id('mx-iffune')]!.damage = 300;
    const r = act(state, { type: 'attack', player: 0, attacker: id('hs-topper'), target: card(id('mx-iffune')) });
    expect(r.state.players[1].graveyard).toContain(id('mx-iffune'));
    expect(st(r.state, id('hs-topper')).hp).toBe(480 - 200 - 80);
    expect(st(r.state, id('hs-kent')).hp).toBe(160 - 80);
  });

  it('Tank: returns 3 cards on the table to their owners', () => {
    const { state, id } = scene({ hand: ['mx-tank'] }, { chars: ['hs-kent', 'hg-rabbit'], terrains: ['hs-carrier'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('mx-tank') });
    expect(r.state.pending).toMatchObject({ kind: 'targets', requests: [{ count: 3, min: 0 }] });
    r = act(r.state, { type: 'chooseTargets', player: 0, targets: [[id('hs-kent'), id('hg-rabbit'), id('hs-carrier')]] });
    expect(r.state.players[1].hand.sort()).toEqual([id('hs-kent'), id('hg-rabbit'), id('hs-carrier')].sort());
  });

  it('Smith: absorbs 50% of every card, recovers his graveyard, attacks 3 times', () => {
    const { state, id } = scene({ hand: ['mx-smith'], graveyard: ['hg-tim', 'hg-patsy'], coins: 13 }, { chars: ['hs-kent'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('mx-smith') });
    const kent = st(r.state, id('hs-kent'));
    expect(kent.hp).toBe(80);
    expect(st(r.state, id('mx-smith')).atk).toBe(150 + (90 - kent.atk));
    const smithAtk = st(r.state, id('mx-smith')).atk;
    expect(r.state.pending).toMatchObject({ kind: 'pick', from: 'graveyard', count: 2, min: 0 });
    r = act(r.state, { type: 'choose', player: 0, picks: [id('hg-patsy'), id('hg-tim')] });
    expect(r.state.players[0].hand.sort()).toEqual([id('hg-patsy'), id('hg-tim')].sort());
    expect(r.state.players[0].graveyard).toEqual([]);
    r.state.instances[id('mx-smith')]!.playedOnTurn = 1; // as if he had arrived earlier
    r = act(r.state, { type: 'attack', player: 0, attacker: id('mx-smith'), target: card(id('hs-kent')) });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('mx-smith'), target: { kind: 'player', player: 1 } });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('mx-smith'), target: { kind: 'player', player: 1 } });
    expect(r.state.players[1].hp).toBe(700 - 2 * smithAtk);
  });

  it('Le Mulo: enemies strike their neighbours; +40/+50 to Matrix cards', () => {
    const { state, id } = scene({ chars: ['mx-mouse'] }, { chars: ['hs-kent', 'hs-washout'] });
    let r = act(state, { type: 'useAbility', player: 0, iid: id('mx-mouse'), ability: 0 });
    expect(st(r.state, id('hs-kent')).hp).toBe(160 - 60);
    expect(r.state.players[1].graveyard).toContain(id('hs-washout'));
    // an attack ability: no normal attack this turn, and only every 2 turns
    expect(() => act(r.state, { type: 'attack', player: 0, attacker: id('mx-mouse'), target: card(id('hs-kent')) })).toThrow('NO_ATTACK_LEFT');
    r = act(act(r.state, { type: 'endTurn', player: 0 }).state, { type: 'endTurn', player: 1 });
    expect(() => act(r.state, { type: 'useAbility', player: 0, iid: id('mx-mouse'), ability: 0 })).toThrow('ABILITY_USED');
    const s2 = scene({ hand: ['mx-mouse'] });
    r = act(s2.state, { type: 'playCard', player: 0, iid: s2.id('mx-mouse') });
    expect(st(r.state, s2.id('mx-mouse'))).toMatchObject({ atk: 100, hp: 160 });
  });

  it('Trinity: lethal every 2 turns; prophecy gives Matrix cards a second attack', () => {
    const { state, id } = scene({ chars: ['mx-trinity'] }, { chars: ['mx-smith'] });
    state.instances[id('mx-trinity')]!.playedOnTurn = 1; // turn 3 = 2 turns later -> active
    expect(cycleCountdown(MVP, state, id('mx-trinity'))).toBe(0);
    let r = act(state, { type: 'attack', player: 0, attacker: id('mx-trinity'), target: card(id('mx-smith')) });
    expect(r.state.players[1].graveyard).toContain(id('mx-smith'));
    const s2 = scene({ chars: ['mx-tank'], hand: ['mx-trinity'] }, { chars: ['hg-galahad'] });
    r = act(s2.state, { type: 'playCard', player: 0, iid: s2.id('mx-trinity') });
    expect(attacksAllowed(MVP, r.state, s2.id('mx-tank'))).toBe(2);
  });

  it('Néo: counter-attacks during the enemy turn; calls Trinity; doubles damage and is insensible every 2 turns', () => {
    const { state, id } = scene({ chars: ['hs-topper'] }, { chars: ['mx-neo'], hand: ['mx-trinity'] });
    state.instances[id('mx-neo')]!.playedOnTurn = 2; // not in his cycle this turn
    let r = act(state, { type: 'attack', player: 0, attacker: id('hs-topper'), target: card(id('mx-neo')) });
    expect(r.state.pending).toMatchObject({ kind: 'reaction', player: 1 });
    expect(() => act(r.state, { type: 'endTurn', player: 0 })).toThrow('PENDING_DECISION');
    r = act(r.state, { type: 'react', player: 1, iid: id('mx-neo'), ability: 0, target: card(id('hs-topper')) });
    expect(st(r.state, id('hs-topper')).hp).toBe(480 - 160 - 160);
    const s3 = scene({ hand: ['mx-neo'], graveyard: ['mx-trinity'] });
    const r3 = act(s3.state, { type: 'playCard', player: 0, iid: s3.id('mx-neo') });
    expect(r3.state.players[0].characters).toContain(s3.id('mx-trinity')); // on arrival
    const s2 = scene({ chars: ['hs-kent'] }, { chars: ['mx-neo'] });
    s2.state.instances[s2.id('mx-neo')]!.playedOnTurn = 1; // cycle active: insensible
    const r2 = act(s2.state, { type: 'attack', player: 0, attacker: s2.id('hs-kent'), target: card(s2.id('mx-neo')) });
    expect(st(r2.state, s2.id('mx-neo')).hp).toBe(600);
  });

  it('Cypher: allies copy his stats; your cards take half damage', () => {
    const { state, id } = scene({ chars: ['mx-tank'], hand: ['mx-cypher'] }, { chars: ['hs-kent'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('mx-cypher') });
    expect(st(r.state, id('mx-tank'))).toMatchObject({ atk: 70, hp: 150 });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('mx-tank'), target: card(id('hs-kent')) });
    expect(st(r.state, id('mx-tank')).hp).toBe(150 - 40); // 90 halved → 45 → 40
  });
});

describe('4.2 Sacré Graal', () => {
  it('Arthur: haste with Patsy, +20 ATQ aura, sends a dying ally home once per game', () => {
    const { state, id } = scene({ chars: ['hg-patsy', 'hg-galahad'], hand: ['hg-arthur'] }, { chars: ['hg-rabbit'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('hg-arthur') });
    expect(st(r.state, id('hg-galahad')).atk).toBe(70);
    r = act(r.state, { type: 'attack', player: 0, attacker: id('hg-galahad'), target: card(id('hg-rabbit')) });
    expect(r.state.players[0].hand).toContain(id('hg-galahad')); // dying Galahad goes home
    expect(canAttackQ(MVP, r.state, id('hg-arthur'))).toBeNull(); // haste thanks to Patsy
  });

  it('Le Chevalier noir survives 3 deaths at 10 PV, losing 30 ATQ each time', () => {
    const { state, id } = scene({ chars: ['hs-topper'] }, { chars: ['hg-black-knight'] });
    let s = state;
    for (let k = 0; k < 3; k++) {
      s.instances[id('hs-topper')]!.attacksUsed = 0;
      s.instances[id('hs-topper')]!.damage = 0;
      s.instances[id('hg-black-knight')]!.damage += 340 - (k === 0 ? 0 : 0);
      s = act(s, { type: 'attack', player: 0, attacker: id('hs-topper'), target: card(id('hg-black-knight')) }).state;
      expect(st(s, id('hg-black-knight'))).toMatchObject({ hp: 10, atk: 110 - 30 * (k + 1) });
    }
    s.instances[id('hs-topper')]!.attacksUsed = 0;
    s.instances[id('hs-topper')]!.damage = 0;
    s = act(s, { type: 'attack', player: 0, attacker: id('hs-topper'), target: card(id('hg-black-knight')) }).state;
    expect(s.players[1].graveyard).toContain(id('hg-black-knight'));
  });

  it('Le Lapin de Caerbannog attacks without riposte', () => {
    const { state, id } = scene({ chars: ['hg-rabbit'] }, { chars: ['hs-topper'] });
    const r = act(state, { type: 'attack', player: 0, attacker: id('hg-rabbit'), target: card(id('hs-topper')) });
    expect(st(r.state, id('hg-rabbit')).hp).toBe(90);
    expect(st(r.state, id('hs-topper')).hp).toBe(280);
  });

  it('Les Chevaliers « Ni ! » silence an enemy for a turn', () => {
    const { state, id } = scene({ chars: ['hg-ni'] }, { chars: ['mx-dozer', 'mx-tank'] });
    const r = act(state, { type: 'useAbility', player: 0, iid: id('hg-ni'), ability: 0, targets: [card(id('mx-dozer'))] });
    expect(st(r.state, id('mx-tank')).atk).toBe(30); // Dozer's aura is off
  });

  it('Tim l’Enchanteur deals 50 on arrival; Lancelot charges at once for 20 self-damage', () => {
    const { state, id } = scene({ hand: ['hg-tim', 'hg-lancelot'] }, { chars: ['hs-kent'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('hg-tim'), targets: [card(id('hs-kent'))] });
    expect(st(r.state, id('hs-kent')).hp).toBe(110);
    r = act(r.state, { type: 'playCard', player: 0, iid: id('hg-lancelot') });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('hg-lancelot'), target: card(id('hs-kent')) });
    expect(st(r.state, id('hg-lancelot')).hp).toBe(160 - 90 - 20);
  });

  it('Le Gardien du pont throws the attacker into the gorge on 1-2', () => {
    const { state, id } = scene({ chars: ['hs-kent'] }, { chars: ['hg-bridgekeeper'] });
    forceDice(state, 2);
    const r = act(state, { type: 'attack', player: 0, attacker: id('hs-kent'), target: card(id('hg-bridgekeeper')) });
    expect(r.state.players[0].graveyard).toContain(id('hs-kent'));
    expect(st(r.state, id('hg-bridgekeeper')).hp).toBe(130);
  });

  it('Sire Robin runs back to the hand on 1-3', () => {
    const { state, id } = scene({ chars: ['hs-kent'] }, { chars: ['hg-robin'] });
    forceDice(state, 1);
    const r = act(state, { type: 'attack', player: 0, attacker: id('hs-kent'), target: card(id('hg-robin')) });
    expect(r.state.players[1].hand).toContain(id('hg-robin'));
    expect(st(r.state, id('hs-kent')).hp).toBe(160);
  });

  it('Sire Galahad cannot be silenced; Patsy has no effect of its own', () => {
    const { state, id } = scene({ chars: ['hg-ni'] }, { chars: ['hg-galahad', 'hg-patsy'] });
    const r = act(state, { type: 'useAbility', player: 0, iid: id('hg-ni'), ability: 0, targets: [card(id('hg-galahad'))] });
    expect(st(r.state, id('hg-galahad')).atk).toBe(50);
  });

  it('La Sainte Grenade: 150 to a target and 50 to its neighbours; Fuyez returns 2 allies', () => {
    const { state, id } = scene({ chars: ['hg-patsy', 'hg-galahad'], hand: ['hg-grenade', 'hg-run-away'] }, { chars: ['hs-kent', 'hs-topper', 'hs-washout'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('hg-grenade'), targets: [card(id('hs-topper'))] });
    expect(st(r.state, id('hs-topper')).hp).toBe(480 - 150);
    expect(st(r.state, id('hs-kent')).hp).toBe(110);
    r = act(r.state, { type: 'playCard', player: 0, iid: id('hg-run-away'), targets: [card(id('hg-patsy')), card(id('hg-galahad'))] });
    expect(r.state.players[0].characters.filter(Boolean)).toHaveLength(0);
  });

  it('Camelot: +30 PV to Holy Grail cards and the opponent cannot play a terrain next turn', () => {
    const { state, id } = scene({ chars: ['hg-galahad'], hand: ['hg-camelot'] }, { hand: ['hs-carrier'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('hg-camelot') });
    expect(st(r.state, id('hg-galahad')).hp).toBe(130);
    r = act(r.state, { type: 'endTurn', player: 0 });
    expect(() => act(r.state, { type: 'playCard', player: 1, iid: id('hs-carrier') })).toThrow('TERRAIN_LOCKED');
  });
});

describe('4.3 Hot Shots!', () => {
  it('Topper: +10 ATQ per kill; every 2 turns hits a protected player without riposte', () => {
    const { state, id } = scene({ chars: ['hs-topper'] }, { chars: ['hg-patsy', 'hs-kent'] });
    let r = act(state, { type: 'attack', player: 0, attacker: id('hs-topper'), target: card(id('hg-patsy')) });
    expect(st(r.state, id('hs-topper')).atk).toBe(160);
    r = act(r.state, { type: 'endTurn', player: 0 });
    r = act(r.state, { type: 'endTurn', player: 1 });
    r = act(r.state, { type: 'useAbility', player: 0, iid: id('hs-topper'), ability: 1 });
    expect(attackTargets(MVP, r.state, id('hs-topper'))).toContainEqual({ kind: 'player', player: 1 });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('hs-topper'), target: { kind: 'player', player: 1 } });
    expect(r.state.players[1].hp).toBe(540);
  });

  it('Ramada boosts Topper for the turn; Kent hits Hot Shots! cards harder', () => {
    const { state, id } = scene({ chars: ['hs-ramada', 'hs-topper', 'hs-kent'] }, { chars: ['hs-washout'] });
    let r = act(state, { type: 'useAbility', player: 0, iid: id('hs-ramada'), ability: 0, targets: [card(id('hs-topper'))] });
    expect(st(r.state, id('hs-topper'))).toMatchObject({ atk: 190, hp: 520 });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('hs-kent'), target: card(id('hs-washout')) });
    expect(r.events.find((e) => e.type === 'damageDealt' && e.target === id('hs-washout'))).toMatchObject({ amount: 120 });
  });

  it('Amiral Benson loses 10 PV and boosts Hot Shots! cards each turn', () => {
    const { state, id } = scene({ chars: ['hs-benson', 'hs-kent'] });
    let r = act(state, { type: 'endTurn', player: 0 });
    r = act(r.state, { type: 'endTurn', player: 1 });
    expect(st(r.state, id('hs-benson'))).toMatchObject({ hp: 130, atk: 60 });
    expect(st(r.state, id('hs-kent')).atk).toBe(110);
    // the bonus lasts until the end of the turn: it does not stack (story 11.6)
    r = act(r.state, { type: 'endTurn', player: 0 });
    expect(st(r.state, id('hs-kent')).atk).toBe(90);
    r = act(r.state, { type: 'endTurn', player: 1 });
    expect(st(r.state, id('hs-kent')).atk).toBe(110);
  });

  it('Wash Out may hit a random card on 1-2; Dead Meat draws 2 when he dies', () => {
    const { state, id } = scene({ chars: ['hs-washout'] }, { chars: ['hs-dead-meat'] });
    forceDice(state, 6);
    const r = act(state, { type: 'attack', player: 0, attacker: id('hs-washout'), target: card(id('hs-dead-meat')) });
    expect(r.state.players[1].hand).toHaveLength(2);
  });

  it('Le Commandant gives an ally a second attack; Le dîner heals; the missile hits the strongest', () => {
    const { state, id } = scene({ chars: ['hs-kent'], hand: ['hs-wingman', 'hs-belly', 'hs-missile'] }, { chars: ['hs-topper', 'hg-patsy'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('hs-wingman'), targets: [card(id('hs-kent'))] });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('hs-kent'), target: card(id('hg-patsy')) });
    r = act(r.state, { type: 'attack', player: 0, attacker: id('hs-kent'), target: card(id('hs-topper')) });
    const ally = r.state.players[0].characters.find((x): x is string => !!x)!; // Kent may have fallen to the riposte
    r = act(r.state, { type: 'playCard', player: 0, iid: id('hs-belly'), targets: [card(ally)] });
    expect(r.events.some((e) => e.type === 'healed')).toBe(true);
    r.state.players[0].coins = 10;
    r = act(r.state, { type: 'playCard', player: 0, iid: id('hs-missile') });
    expect(r.events.find((e) => e.type === 'damageDealt')).toMatchObject({ target: id('hs-topper'), amount: 120 });
  });

  it('Le porte-avions: +20 ATQ to Hot Shots! cards', () => {
    const { state, id } = scene({ chars: ['hs-kent'], terrains: ['hs-carrier'] });
    expect(st(state, id('hs-kent')).atk).toBe(110);
  });
});

describe('4.4 White Chicks', () => {
  it('Latrell stuns every enemy for a turn; +30 ATQ while Marcus is on the other side', () => {
    const { state, id } = scene({ hand: ['wc-latrell'] }, { chars: ['wc-marcus'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('wc-latrell') });
    expect(st(r.state, id('wc-latrell')).atk).toBe(170);
    r = act(r.state, { type: 'endTurn', player: 0 });
    expect(() => act(r.state, { type: 'attack', player: 1, attacker: id('wc-marcus'), target: card(id('wc-latrell')) })).toThrow('STUNNED');
  });

  it('Marcus: untouchable by spells for 2 turns, +50 PV with Kevin', () => {
    const { state, id } = scene({ hand: ['wc-marcus'], chars: ['wc-kevin'] }, { hand: ['mx-pills'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('wc-marcus') });
    expect(st(r.state, id('wc-marcus')).hp).toBe(350);
    expect(st(r.state, id('wc-kevin')).hp).toBe(330);
    r = act(r.state, { type: 'endTurn', player: 0 });
    r = act(r.state, { type: 'playCard', player: 1, iid: id('mx-pills'), option: 1, targets: [card(id('wc-marcus'))] });
    expect(st(r.state, id('wc-marcus')).atk).not.toBe(30); // Marcus not targetable; the pill hits Kevin instead
  });

  it('Kevin resets a card once per game; the heiresses give 3 bonus coins', () => {
    const { state, id } = scene({ chars: ['wc-kevin'], hand: ['wc-heiresses'], coins: 4 }, { chars: ['hs-kent'] });
    state.instances[id('hs-kent')]!.modifiers.push({ source: 'x', label: 'x', atk: 100, hp: 0 });
    let r = act(state, { type: 'useAbility', player: 0, iid: id('wc-kevin'), ability: 0, targets: [card(id('hs-kent'))] });
    expect(st(r.state, id('hs-kent')).atk).toBe(90);
    r = act(r.state, { type: 'playCard', player: 0, iid: id('wc-heiresses') });
    expect(r.state.players[0].coins).toBe(3);
    expect(r.state.players[0].bonusCoins).toBe(3);
    r = act(r.state, { type: 'endTurn', player: 0 });
    expect(r.state.players[0].coins).toBe(0);
  });

  it('Les Vandergeld (−30 ATQ), Warren (+20 traqueurs), Gomez (+20 vs Copeland), Elliott (discard)', () => {
    const { state, id } = scene({ chars: ['wc-vandergeld', 'wc-warren', 'wc-gomez'], hand: ['wc-elliott'] }, { chars: ['wc-kevin'], hand: ['hg-patsy'] });
    let r = act(state, { type: 'useAbility', player: 0, iid: id('wc-vandergeld'), ability: 0, targets: [card(id('wc-kevin'))] });
    expect(st(r.state, id('wc-kevin')).atk).toBe(90);
    expect(st(r.state, id('wc-vandergeld')).atk).toBe(90);
    r = act(r.state, { type: 'attack', player: 0, attacker: id('wc-gomez'), target: card(id('wc-kevin')) });
    expect(r.events.find((e) => e.type === 'damageDealt' && e.target === id('wc-kevin'))).toMatchObject({ amount: 60 });
    r = act(r.state, { type: 'playCard', player: 0, iid: id('wc-elliott') });
    expect(r.state.players[1].hand).toHaveLength(0);
  });

  it('Battle de danse destroys the weaker dancer; Les Hamptons: +30 ATQ and coin cap 13', () => {
    const { state, id } = scene({ chars: ['hs-topper'], hand: ['wc-dance', 'wc-hamptons'] }, { chars: ['hs-kent'] });
    let r = act(state, { type: 'playCard', player: 0, iid: id('wc-dance'), targets: [card(id('hs-topper')), card(id('hs-kent'))] });
    expect(r.state.players[1].graveyard).toContain(id('hs-kent'));
    r = act(r.state, { type: 'playCard', player: 0, iid: id('wc-hamptons') });
    r.state.players[0].coins = 12;
    r = act(r.state, { type: 'endTurn', player: 0 });
    expect(r.state.players[0].coins).toBe(12);
  });
});
