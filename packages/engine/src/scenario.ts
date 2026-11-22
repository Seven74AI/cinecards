import { fileURLToPath } from 'node:url';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { apply } from './apply.ts';
import { createGame } from './state/create.ts';
import type { Action, ApplyResult, Catalog, GameEvent, GameState, PlayerId } from './types.ts';

export const MVP: Catalog = loadSetsFromDir(fileURLToPath(new URL('../../../content/sets', import.meta.url))).catalog;

interface Side {
  chars?: string[];
  hand?: string[];
  terrains?: string[];
  spells?: string[];
  graveyard?: string[];
  coins?: number;
  fresh?: string[]; // characters placed this turn (summoning sick)
}

/** Builds a mid-game position with real MVP cards: both players at turn 3, player 0 active. */
export function scene(p0: Side = {}, p1: Side = {}, seed = 1): { state: GameState; id: (cardId: string) => string } {
  const { state } = createGame(MVP, { seed, autoStart: false });
  const byCard = new Map(Object.values(state.instances).map((i) => [i.cardId, i.iid]));
  const id = (cardId: string) => {
    const iid = byCard.get(cardId);
    if (!iid) throw new Error(`no card ${cardId}`);
    return iid;
  };
  state.active = 0;
  ([p0, p1] as Side[]).forEach((side, player) => {
    const P = state.players[player as PlayerId];
    P.turnNumber = 3;
    P.coins = side.coins ?? 10;
    const take = (cardId: string) => {
      const iid = id(cardId);
      state.sharedDeck = state.sharedDeck.filter((x) => x !== iid);
      state.instances[iid]!.owner = player as PlayerId;
      return iid;
    };
    (side.chars ?? []).forEach((c, i) => {
      P.characters[i] = take(c);
      state.instances[P.characters[i]!]!.playedOnTurn = (side.fresh ?? []).includes(c) ? 3 : 1;
    });
    (side.terrains ?? []).forEach((c, i) => {
      P.terrains[i] = take(c);
      state.instances[P.terrains[i]!]!.playedOnTurn = 1;
    });
    (side.spells ?? []).forEach((c, i) => {
      P.spells[i] = take(c);
      state.instances[P.spells[i]!]!.playedOnTurn = 1;
    });
    for (const c of side.hand ?? []) P.hand.push(take(c));
    for (const c of side.graveyard ?? []) P.graveyard.push(take(c));
  });
  return { state, id };
}

export function act(state: GameState, action: Action, catalog: Catalog = MVP): Extract<ApplyResult, { ok: true }> {
  const r = apply(catalog, state, action);
  if (!r.ok) throw new Error(`refused: ${r.error.code} ${JSON.stringify(r.error.params ?? {})}`);
  return r;
}

export const types = (events: GameEvent[]) => events.map((e) => e.type);
export const card = (iid: string) => ({ kind: 'card' as const, iid });

import { rollD6 } from './rng.ts';
/** Sets the RNG so that the next d6 rolled shows `value`. */
export function forceDice(state: GameState, value: number): void {
  for (let r = 1; r < 100000; r++) {
    const h = { rng: r };
    if (rollD6(h) === value) {
      state.rng = r;
      return;
    }
  }
}
