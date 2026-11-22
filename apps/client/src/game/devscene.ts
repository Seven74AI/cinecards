import { createGame, type Catalog, type GameState, type PlayerId } from '@cinecards/engine';

/**
 * Dev-only test positions (story 12.1), opened with `?scene=<name>` on the dev server: a fixed table so
 * the e2e tests can check the order of the animation beats. Never used in production (see App.tsx).
 */
const SCENES: Record<string, [string[], string[]]> = {
  // Topper Harley (150 ATQ) can kill the Knights who say "Ni!" (150 PV) next to the Black Knight
  mort: [['hs-topper', 'hg-lancelot'], ['hg-ni', 'hg-black-knight']],
  // nobody in the foe's slots: Topper can hit the player's portrait
  joueur: [['hs-topper'], []],
  // the Knights' special attack "Ni !" silences an enemy character, without contact
  speciale: [['hg-ni'], ['hg-lancelot', 'hg-black-knight']],
};

export function devScene(catalog: Catalog, name: string): GameState | null {
  const sides = SCENES[name];
  if (!sides) return null;
  const { state } = createGame(catalog, { seed: 7, autoStart: false });
  const byCard = new Map(Object.values(state.instances).map((i) => [i.cardId, i.iid]));
  state.active = 0;
  state.firstPlayer = 0;
  sides.forEach((chars, player) => {
    const P = state.players[player as PlayerId];
    P.turnNumber = 3;
    P.coins = 10;
    P.coinCap = 10;
    chars.forEach((cardId, slot) => {
      const iid = byCard.get(cardId);
      if (!iid) return;
      state.sharedDeck = state.sharedDeck.filter((x) => x !== iid);
      state.instances[iid]!.owner = player as PlayerId;
      state.instances[iid]!.playedOnTurn = 1;
      P.characters[slot] = iid;
    });
    for (let i = 0; i < 4 && state.sharedDeck.length; i++) {
      const iid = state.sharedDeck.shift()!;
      state.instances[iid]!.owner = player as PlayerId;
      P.hand.push(iid);
    }
  });
  return state;
}
