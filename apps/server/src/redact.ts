import type { GameEvent, GameState, PlayerId } from '@cinecards/engine';
import { HIDDEN } from '@cinecards/protocol';

/**
 * Builds what `viewer` may see (story 6.3): opponent hand and every pile become anonymous ids
 * with no instance, the RNG is zeroed (it would predict dice and draws). Cards offered to the
 * viewer in a pending pick stay visible.
 */
export function redactState(state: GameState, viewer: PlayerId): GameState {
  const s: GameState = JSON.parse(JSON.stringify(state));
  const visible = new Set<string>(s.pending?.kind === 'pick' && s.pending.player === viewer ? s.pending.options : []);
  let n = 0;
  const hide = (list: string[]) =>
    list.map((iid) => {
      if (visible.has(iid)) return iid;
      delete s.instances[iid];
      return `${HIDDEN}${n++}`;
    });
  const foe: PlayerId = viewer === 0 ? 1 : 0;
  s.players[foe].hand = hide(s.players[foe].hand);
  s.sharedDeck = hide(s.sharedDeck);
  s.players[0].deck = hide(s.players[0].deck);
  s.players[1].deck = hide(s.players[1].deck);
  if (s.pending?.kind === 'pick' && s.pending.player !== viewer) s.pending = { ...s.pending, options: s.pending.options.map(() => HIDDEN) };
  s.rng = 0;
  s.seed = 0;
  return s;
}

/** Removes the identity of cards the viewer cannot see from an event batch. */
export function redactEvents(events: GameEvent[], viewer: PlayerId): GameEvent[] {
  return events.map((e) => (e.type === 'cardDrawn' && e.player !== viewer ? { ...e, iid: HIDDEN } : e));
}
