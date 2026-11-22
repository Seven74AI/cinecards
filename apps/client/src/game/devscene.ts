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
};

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
  return state;
}
