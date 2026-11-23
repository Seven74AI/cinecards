import { RULES } from '../rules.ts';
import { randomInt, shuffleInPlace } from '../rng.ts';
import type { Catalog, DeckMode, GameEvent, GameState, PlayerId } from '../types.ts';
import { emptyPlayer, newInstance } from './helpers.ts';
import { drawCard, startTurn } from '../turn/turn.ts';
import { newG } from '../ctx.ts';
import { playableCardIds } from '../support.ts';
import { validateDeck } from '@cinecards/cards/deck';

export interface CreateGameOptions {
  seed: number;
  mode?: DeckMode;
  /** Card ids in the deck (shared, randomSplit); defaults to one copy of every playable card. */
  cardIds?: string[];
  /** constructed mode: each player's deck, checked with `validateDeck` (exactly 50 playable cards, one copy each). */
  decks?: [string[], string[]];
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

  if (mode === 'constructed') {
    // story 10.1: one validated 50-card deck per player, each shuffled with the seed
    if (!opts.decks) throw new Error('constructed mode needs one deck per player');
    const playable = playableCardIds(catalog);
    for (const p of [0, 1] as const) {
      const check = validateDeck(opts.decks[p], catalog, playable);
      if (!check.ok) throw new Error(`invalid deck for player ${p}: ${check.errors.map((e) => e.code).join(', ')}`);
    }
    for (const p of [0, 1] as const) {
      const pile = [...opts.decks[p]].sort().map((id) => newInstance(state, id, p, catalog.get(id)!).iid);
      state.players[p].deck = shuffleInPlace(state, pile);
    }
  } else {
    const ids = [...(opts.cardIds ?? playableCardIds(catalog))].sort();
    const deck = ids.map((id) => newInstance(state, id, 0, catalog.get(id)!).iid);
    shuffleInPlace(state, deck);
    splitDeck(state, mode, deck);
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

function splitDeck(state: GameState, mode: DeckMode, deck: string[]): void {
  if (mode === 'shared') {
    state.sharedDeck = deck;
  } else {
    const half = Math.floor(deck.length / 2);
    state.players[0].deck = deck.slice(0, half);
    state.players[1].deck = deck.slice(half, half * 2);
    state.sharedDeck = deck.slice(half * 2); // odd card out stays unused
  }
}
