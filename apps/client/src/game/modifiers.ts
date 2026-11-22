import type { Catalog, GameState, StatSource } from '@cinecards/engine';

/**
 * Where a character's bonuses and penalties come from (story 13.3), for the board marker,
 * the glowing lines from each source and the sheet's list.
 */
export interface ModifierLine {
  /** Instance id of the source card, or a rule name. */
  source: string;
  /** Catalog card of the source, when the source is a card. */
  cardId?: string;
  /** Index of the ability in the source card (matched by name), for the preview's highlight. */
  ability?: number;
  label: string;
  atk: number;
  hp: number;
  tone: 'buff' | 'malus';
  /** The source is on a table right now (line drawn); false = "carte partie" (or a rule). */
  inPlay: boolean;
  /** The card modifies itself (Topper's kill count): no line. */
  self: boolean;
  duration: string;
}

export function onTable(state: GameState, iid: string): boolean {
  return ([0, 1] as const).some((p) => {
    const P = state.players[p];
    return P.characters.includes(iid) || P.terrains.includes(iid) || P.spells.includes(iid);
  });
}

/** "tant qu'elle est en jeu" (aura), "encore 2 tours", "permanent". */
export function durationFr(s: Pick<StatSource, 'turnsLeft' | 'aura'>): string {
  if (s.aura) return 'tant qu’elle est en jeu';
  if (s.turnsLeft === undefined) return 'permanent';
  return `encore ${s.turnsLeft} tour${s.turnsLeft > 1 ? 's' : ''}`;
}

export function signed(n: number, unit: string): string {
  return `${n > 0 ? '+' : '−'}${Math.abs(n)} ${unit}`;
}

export function modifierLines(catalog: Catalog, state: GameState, target: string, sources: StatSource[]): ModifierLine[] {
  return sources
    .filter((s) => s.atk !== 0 || s.hp !== 0)
    .map((s) => {
      const inst = state.instances[s.source];
      const card = inst ? catalog.get(inst.cardId) : undefined;
      const ability = card ? card.abilities.findIndex((a) => a.name === s.label) : -1;
      return {
        source: s.source,
        cardId: card?.id,
        ability: ability >= 0 ? ability : undefined,
        label: s.label,
        atk: s.atk,
        hp: s.hp,
        tone: s.atk + s.hp >= 0 ? 'buff' : 'malus',
        inPlay: !!inst && onTable(state, s.source),
        self: s.source === target,
        duration: durationFr(s),
      };
    });
}

/** How many sources change each badge (the small number on a modified ATK / HP badge). */
export function sourceCounts(sources: StatSource[] | undefined): { atk: number; hp: number } {
  return { atk: sources?.filter((s) => s.atk !== 0).length ?? 0, hp: sources?.filter((s) => s.hp !== 0).length ?? 0 };
}
