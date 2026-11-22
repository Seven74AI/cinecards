import type { PlayerId } from '../types.ts';
import { cardOf, characters, hasStatus, inst, type G } from '../ctx.ts';

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/** Key identifying "this turn of the acting player", so a card reacts at most once per enemy turn. */
export const reactionKey = (g: G, actor: PlayerId): string => `${actor}:${g.s.players[actor].turnNumber}`;

/**
 * After an action by `actor`, opens a reaction window (architecture P3) for the other player
 * if they have a usable counter-attack reaction. No window opens otherwise.
 */
export function offerReaction(g: G, actor: PlayerId): void {
  if (g.s.phase === 'finished' || g.s.pending) return;
  const defender = other(actor);
  const key = reactionKey(g, actor);
  const options: { iid: string; ability: number }[] = [];
  for (const b of characters(g, defender)) {
    if (hasStatus(g, b.iid, 'silence') || inst(g, b.iid).reactedOn === key) continue;
    cardOf(g, b.iid).abilities.forEach((ab, index) => {
      if (ab.kind === 'reaction' && (ab.effects ?? []).some((e) => e.op === 'counterAttack')) options.push({ iid: b.iid, ability: index });
    });
  }
  if (options.length === 0) return;
  g.s.pending = { kind: 'reaction', player: defender, options, key };
  g.ev.push({ type: 'reactionOffered', player: defender });
}
