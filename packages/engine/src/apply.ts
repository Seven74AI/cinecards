import type { Action, ApplyResult, Catalog, GameState } from './types.ts';
import { newG } from './ctx.ts';
import { playCard } from './play/play.ts';
import { attack } from './combat/combat.ts';
import { endTurn } from './turn/turn.ts';
import { checkWinner } from './effects/core.ts';
import { choose, pass, react, useAbility } from './play/abilities.ts';

/**
 * The engine's single entry point (architecture AR4): pure, deterministic, never throws for rule violations.
 * The input state is never mutated.
 */
export function apply(catalog: Catalog, state: GameState, action: Action): ApplyResult {
  if (state.phase === 'finished') return { ok: false, error: { code: 'GAME_OVER' } };
  const pending = state.pending;
  if (action.type !== 'concede') {
    if (pending) {
      const allowed = pending.kind === 'reaction' ? ['react', 'pass'] : ['choose'];
      if (action.player !== pending.player || !allowed.includes(action.type)) return { ok: false, error: { code: 'PENDING_DECISION' } };
    } else if (action.player !== state.active) {
      return { ok: false, error: { code: 'NOT_YOUR_TURN' } };
    } else if (action.type === 'react' || action.type === 'pass' || action.type === 'choose') {
      return { ok: false, error: { code: 'NOTHING_PENDING' } };
    }
  }

  // GameState is plain JSON data by design, so a JSON round-trip is a safe, dependency-free deep copy.
  const g = newG(catalog, JSON.parse(JSON.stringify(state)) as GameState);

  switch (action.type) {
    case 'playCard':
      return playCard(g, action.player, action.iid, action.slot, action.targets ?? [], action.option);
    case 'attack':
      return attack(g, action.player, action.attacker, action.target);
    case 'useAbility':
      return useAbility(g, action.player, action.iid, action.ability, action.targets ?? [], action.option);
    case 'react':
      return react(g, action.player, action.iid, action.ability, action.target);
    case 'pass':
      return pass(g, action.player);
    case 'choose':
      return choose(g, action.player, action.picks);
    case 'endTurn':
      endTurn(g);
      return { ok: true, state: g.s, events: g.ev };
    case 'concede':
      g.ev.push({ type: 'conceded', player: action.player });
      g.s.players[action.player].hp = 0;
      checkWinner(g);
      return { ok: true, state: g.s, events: g.ev };
  }
}
