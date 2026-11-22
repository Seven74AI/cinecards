import type { Catalog, GameEvent, PlayerId } from '@cinecards/engine';

/**
 * Story 13.10: a card that leaves the table because of an opposing effect (sent back to the hand, destroyed by an
 * effect, stolen). Read from the events alone, so the beat planner and the journal agree.
 */
export interface Removal {
  kind: 'returned' | 'destroyed' | 'stolen';
  iid: string;
  /** Whose card it was. */
  owner: PlayerId;
  /** The card whose ability removed it, and that ability's name. */
  source: string;
  ability: string;
  by: PlayerId;
}

export const STAMP: Record<Removal['kind'], string> = { returned: 'RENVOYÉE', destroyed: 'DÉTRUITE', stolen: 'VOLÉE' };

/** The removal event `events[i]`, if an ability of the other player caused it in the same chain. */
export function removalAt(events: GameEvent[], i: number): Removal | null {
  const e = events[i];
  if (!e) return null;
  let kind: Removal['kind'];
  let owner: PlayerId;
  if (e.type === 'returnedToHand') [kind, owner] = ['returned', e.owner];
  else if (e.type === 'cardDestroyed') [kind, owner] = ['destroyed', e.owner];
  else if (e.type === 'summoned' && e.from === 'enemyBoard') [kind, owner] = ['stolen', (1 - e.player) as PlayerId];
  else return null;
  for (let j = i - 1; j >= 0; j--) {
    const x = events[j]!;
    if (x.type === 'abilityUsed') return x.player !== owner ? { kind, iid: e.iid, owner, source: x.iid, ability: x.name, by: x.player } : null;
    // a combat death, or the start of another action: not an effect
    if (x.type === 'attackDeclared' || x.type === 'turnStarted' || x.type === 'turnEnded' || x.type === 'cardPlayed') return null;
  }
  return null;
}

/** "Sire Lancelot le Brave — renvoyée dans votre main par « … » (Tank, adversaire)." */
export function removalText(r: Removal, catalog: Catalog, cardIdOf: (iid: string) => string | undefined, mine: boolean): { title: string; body: string } {
  const name = catalog.get(cardIdOf(r.iid) ?? '')?.name ?? 'Une carte';
  const src = catalog.get(cardIdOf(r.source) ?? '')?.name ?? '?';
  const where = r.kind === 'returned' ? `renvoyée dans ${mine ? 'votre' : 'sa'} main` : r.kind === 'destroyed' ? 'détruite, au cimetière' : 'volée, elle rejoint la table adverse';
  return {
    title: mine ? 'Votre carte a quitté la table' : 'Une carte a quitté la table',
    body: `${name} — ${where}, par « ${r.ability} » (${src}, adversaire).`,
  };
}
