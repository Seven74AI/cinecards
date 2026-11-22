import type { Card } from '@cinecards/cards';
import type { Catalog } from './types.ts';
import { isKnownKind } from './effects/triggers.ts';

/** Ops the engine knows how to execute or query. Anything else marks a card as unsupported (AR6). */
export const KNOWN_OPS = new Set([
  'none', 'cooldown', 'oncePerGame', 'chooseOne', 'modify', 'damage', 'damageEnemies', 'heal', 'status', 'cleanse', 'reset', 'draw',
  'lookAndPick', 'returnToHand', 'summonFrom', 'destroyWhere', 'destroy', 'dice', 'copyStats', 'absorb', 'absorbAllyAtk', 'coinBonus',
  'discardRandom', 'enemiesHitAdjacent', 'playFree', 'duel', 'lockTerrain', 'extraAttack', 'cancelAttack', 'returnSelf', 'destroyAttacker',
  // passive / reaction ops
  'aura', 'damageTaken', 'noRetaliation', 'multiAttack', 'haste', 'onKill', 'onAttacked', 'onAttack', 'startOfTurn', 'surviveDeath',
  'immuneTo', 'attackBonusVs', 'coinCap', 'spellImmuneAfterPlay', 'cycleAtkDouble', 'cycleInsensible', 'cycleLethal',
  'counterAttack', 'cancelDeath', 'returnOnDeath',
]);

/** Why a card cannot be played by the engine yet, or null if fully supported. */
export function unsupportedReason(card: Card): string | null {
  for (const ab of card.abilities) {
    if (!isKnownKind(ab.kind)) return `ability "${ab.name}" uses unknown trigger "${ab.kind}"`;
    if (ab.kind === 'flavor') continue;
    if (!ab.effects || ab.effects.length === 0) return `ability "${ab.name}" has no effects`;
    const stack = [...ab.effects] as { op: string; [k: string]: unknown }[];
    while (stack.length) {
      const e = stack.pop()!;
      if (e.op === 'unsupported') return `ability "${ab.name}" is marked unsupported`;
      if (!KNOWN_OPS.has(e.op)) return `ability "${ab.name}" uses unknown op "${e.op}"`;
      for (const key of ['effects', 'else']) if (Array.isArray(e[key])) stack.push(...(e[key] as never[]));
      if (Array.isArray(e.branches)) for (const b of e.branches as { effects: never[] }[]) stack.push(...b.effects);
      if (Array.isArray(e.options)) for (const o of e.options as never[][]) stack.push(...o);
    }
  }
  return null;
}

export function playableCardIds(catalog: Catalog): string[] {
  return [...catalog.values()].filter((c) => unsupportedReason(c) === null).map((c) => c.id);
}
