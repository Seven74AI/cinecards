import { RULES } from '../rules.ts';
import { randomInt, shuffleInPlace } from '../rng.ts';
import type { Catalog, DeckMode, GameEvent, GameState, PlayerId } from '../types.ts';
import { emptyPlayer, newInstance } from './helpers.ts';
import { drawCard, startTurn } from '../turn/turn.ts';
import { newG } from '../ctx.ts';
import { playableCardIds } from '../support.ts';

export interface CreateGameOptions {
  seed: number;
  mode?: DeckMode;
  /** Card ids in the deck; defaults to one copy of every card in the catalog. */
  cardIds?: string[];
  /** Deal starting hands and start the first turn (default true). Tests can turn it off. */
  autoStart?: boolean;
}

export function createGame(catalog: Catalog, opts: CreateGameOptions): { state: GameState; events: GameEvent[] } {
  const mode = opts.mode ?? 'shared';
  const state: GameState = {
    seed: opts.seed,
    rng: opts.seed >>> 0,
    mode,
    active: 0,
    firstPlayer: 0,
    phase: 'main',
    winner: null,
    players: [emptyPlayer(), emptyPlayer()],
    sharedDeck: [],
    instances: {},
    nextIid: 1,
    pending: null,
    queue: [],
  };
  const events: GameEvent[] = [];

  const ids = [...(opts.cardIds ?? playableCardIds(catalog))].sort();
  const deck = ids.map((id) => newInstance(state, id, 0, catalog.get(id)!).iid);
  shuffleInPlace(state, deck);

  if (mode === 'shared') {
    state.sharedDeck = deck;
  } else {
    const half = Math.floor(deck.length / 2);
    state.players[0].deck = deck.slice(0, half);
    state.players[1].deck = deck.slice(half, half * 2);
    state.sharedDeck = deck.slice(half * 2); // odd card out stays unused
  }

  state.firstPlayer = randomInt(state, 2) as PlayerId;
  events.push({ type: 'gameStarted', firstPlayer: state.firstPlayer, mode });
  if (opts.autoStart === false) return { state, events };

  for (let i = 0; i < RULES.STARTING_HAND; i++) {
    for (const p of [state.firstPlayer, (1 - state.firstPlayer) as PlayerId]) drawCard(state, p, events);
  }
  startTurn(newG(catalog, state, events), state.firstPlayer);
  return { state, events };
}
