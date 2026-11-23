import { createGame, type Catalog, type GameState, type PlayerId } from '@cinecards/engine';

/**
 * Dev-only test positions (epic 12), opened with `?scene=<name>` on the dev server: a fixed table so
 * the e2e tests can check the order of the animation beats. Never used in production (see App.tsx).
 * Each scene: [my characters, foe characters, cards first in my hand]. A character may carry `+shield`
 * (40-point shield) or `+hurtN` (N damage already taken).
 */
const SCENES: Record<string, [string[], string[], string[]?]> = {
  // Topper Harley (150 ATQ) can kill the Knights who say "Ni!" (150 PV) next to the Black Knight
  mort: [['hs-topper', 'hg-lancelot'], ['hg-ni', 'hg-black-knight']],
  // nobody in the foe's slots: Topper can hit the player's portrait
  joueur: [['hs-topper'], []],
  // the Knights' special attack "Ni !" silences an enemy character, without contact
  speciale: [['hg-ni'], ['hg-lancelot', 'hg-black-knight']],
  // the Knights carry a 40-point shield: Topper's hit cracks it, then they survive at 40 PV
  bouclier: [['hs-topper'], ['hg-ni+shield', 'hg-black-knight']],
  // the Black Knight, at 100 PV, should die to Topper but stays at 10 PV ("Ce n'est qu'une égratignure")
  sauve: [['hs-topper'], ['hg-black-knight+hurt250']],
  // Tank sends up to 3 cards on the table back to their owner's hand when he arrives
  renvoi: [['hg-lancelot'], ['hg-ni', 'hg-black-knight'], ['mx-tank']],
  // Patsy's text cites Arthur (story 13.1): tapping the name previews Arthur, whose slot glows
  renvois: [['hg-patsy', 'hg-arthur'], ['hs-ramada', 'hs-topper']],
  // Lancelot's bonuses and penalties come from Arthur's aura, the Camelot terrain, Heather and Megan (foe)
  // and the red pill, a spell already in the graveyard (story 13.3, see EXTRA), and the A.P.U, an equipment (13.5)
  sources: [['hg-lancelot', 'hg-arthur'], ['wc-vandergeld', 'hs-topper']],
  // a spell, a terrain and an equipment in hand (stories 12.5, 12.6): the missile seeks the strongest ATK, Camelot
  // lifts the Holy Grail family
  pose: [['hs-topper', 'hg-lancelot'], ['hg-ni', 'hg-black-knight'], ['hs-missile', 'hg-camelot', 'mx-apu']],
  // Le Grimoire is down to 100 PV with no character: Topper's hit wins the game (story 12.7, see EXTRA)
  victoire: [['hs-topper'], []],
  // Néo already doubled once (320 ATQ) and doubles again at the start of my next turn (story 13.4); empty hands
  // and deck so Le Grimoire can only end its turn
  neo: [['mx-neo'], []],
  // story 13.10: Le Grimoire holds only Tank; on its turn it plays it and sends my cards back to my hand
  retrait: [['hg-lancelot', 'hs-topper'], []],
  // story 14.1: a full table (mockup F): 4 characters of mine, 7 of the foe, terrains and spells on both sides, and a
  // hand of 10 cards (see EXTRA)
  pleine: [
    ['hg-patsy', 'mx-cypher', 'hs-topper', 'wc-gomez'],
    ['hg-galahad', 'hg-bridgekeeper', 'hs-kent', 'hg-black-knight', 'hg-robin', 'hg-tim', 'mx-keymaker'],
  ],
};

type Take = (cardId: string, player: PlayerId) => string | null;
/** Extra setup after the characters are placed: terrains, graveyards, modifiers. */
const EXTRA: Record<string, (state: GameState, take: Take, iidOf: (cardId: string) => string) => void> = {
  pleine: (state, take) => {
    const put = (cardId: string, player: PlayerId, zone: 'terrains' | 'spells', slot: number) => {
      const iid = take(cardId, player);
      if (!iid) return;
      state.instances[iid]!.playedOnTurn = 1;
      state.players[player][zone][slot] = iid;
    };
    put('mx-matrix', 0, 'terrains', 0);
    put('mx-recharge', 0, 'spells', 0);
    put('mx-apu', 0, 'spells', 1);
    put('hg-camelot', 1, 'terrains', 0);
    put('hs-carrier', 1, 'terrains', 1);
    put('hg-run-away', 1, 'spells', 0);
    const me = state.players[0];
    while (me.hand.length < 10 && state.sharedDeck.length) {
      const iid = state.sharedDeck.shift()!;
      state.instances[iid]!.owner = 0;
      me.hand.push(iid);
    }
  },
  retrait: (state, take) => {
    const tank = take('mx-tank', 1)!;
    state.players[1].hand = [tank];
  },
  victoire: (state) => {
    state.players[1].hp = 100;
  },
  neo: (state, _take, iidOf) => {
    const neo = state.instances[iidOf('mx-neo')]!;
    state.players[0].turnNumber = 5;
    neo.playedOnTurn = 2; // doubled on my turn 4, doubles again on my turn 6
    neo.modifiers.push({ source: neo.iid, label: "Y m'faut des armes, un maximum d'armes", atk: 160, hp: 0 });
    for (const P of state.players) P.hand = [];
    state.sharedDeck = [];
  },
  sources: (state, take, iidOf) => {
    const camelot = take('hg-camelot', 0)!;
    state.instances[camelot]!.playedOnTurn = 1;
    state.players[0].terrains[0] = camelot;
    const pills = take('mx-pills', 0)!;
    state.players[0].graveyard.push(pills);
    const apu = take('mx-apu', 0)!; // an equipment, also gone (story 13.5: every category shows in the list)
    state.players[0].graveyard.push(apu);
    const lancelot = state.instances[iidOf('hg-lancelot')]!;
    lancelot.modifiers.push(
      { source: iidOf('wc-vandergeld'), label: 'Langue de vipère', atk: -30, hp: 0 },
      { source: pills, label: 'Choisis la pilule rouge et on descend avec le lapin blanc au fond du gouffre', atk: 100, hp: 100 },
      { source: apu, label: 'Commandant Lock, toutes les A.P.U sont en position !', atk: 100, hp: 0 },
    );
  },
};

/** Seed of the bot for the scenes where its choices matter (story 13.10: it sends my cards back with Tank). */
const BOT_SEEDS: Record<string, number> = { retrait: 9 };
export const devBotSeed = (name: string): number | undefined => BOT_SEEDS[name];

export function devScene(catalog: Catalog, name: string): GameState | null {
  const scene = SCENES[name];
  if (!scene) return null;
  const { state } = createGame(catalog, { seed: 7, autoStart: false });
  const byCard = new Map(Object.values(state.instances).map((i) => [i.cardId, i.iid]));
  const take = (cardId: string, player: PlayerId) => {
    const iid = byCard.get(cardId);
    if (!iid) return null;
    state.sharedDeck = state.sharedDeck.filter((x) => x !== iid);
    state.instances[iid]!.owner = player;
    return iid;
  };
  state.active = 0;
  state.firstPlayer = 0;
  ([0, 1] as const).forEach((player) => {
    const P = state.players[player];
    P.turnNumber = 3;
    P.coins = 10;
    P.coinCap = 10;
    scene[player].forEach((spec, slot) => {
      const [cardId = '', extra = ''] = spec.split('+');
      const iid = take(cardId, player);
      if (!iid) return;
      const inst = state.instances[iid]!;
      inst.playedOnTurn = 1;
      if (extra === 'shield') inst.statuses.push({ kind: 'shield', amount: 40, source: 'scene' });
      if (extra.startsWith('hurt')) inst.damage = Number(extra.slice(4)) || 0;
      P.characters[slot] = iid;
    });
    for (const cardId of player === 0 ? (scene[2] ?? []) : []) {
      const iid = take(cardId, player);
      if (iid) P.hand.push(iid);
    }
    while (P.hand.length < 4 && state.sharedDeck.length) {
      const iid = state.sharedDeck.shift()!;
      state.instances[iid]!.owner = player;
      P.hand.push(iid);
    }
  });
  EXTRA[name]?.(state, take, (cardId) => byCard.get(cardId)!);
  return state;
}
