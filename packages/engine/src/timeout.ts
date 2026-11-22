import type { Action, GameState } from './types.ts';

/**
 * What the game does for a player whose turn timer ran out (stories 6.4, 11.3): pending choices are
 * resolved with their default (a reaction is passed, a pick keeps the first cards offered), then the
 * active player's turn ends. Apply the returned actions one by one until it returns null.
 */
export function timeoutAction(state: GameState): Action | null {
  if (state.phase === 'finished') return null;
  const p = state.pending;
  if (p?.kind === 'reaction') return { type: 'pass', player: p.player };
  if (p?.kind === 'pick') return { type: 'choose', player: p.player, picks: p.options.slice(0, p.count) };
  return { type: 'endTurn', player: state.active };
}
