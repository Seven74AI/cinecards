import { RULES } from '../rules.ts';
import type { Catalog, GameState, Modifier } from '../types.ts';
import { cardOf } from './helpers.ts';

export interface StatSource {
  source: string;
  label: string;
  atk: number;
  hp: number;
}

export interface ComputedStats {
  atk: number;
  hp: number;
  maxHp: number;
  baseAtk: number;
  baseHp: number;
  sources: StatSource[];
  /** Multi-body cards: per-body current hp and atk (living and dead). */
  bodies?: { hp: number; atk: number; alive: boolean }[];
}

/**
 * Derived stats (architecture P2): never stored, always recomputed from base values + modifiers.
 * Auras from the effect system (epic 3) plug in through `extraModifiers`.
 */
export function computeStats(catalog: Catalog, state: GameState, iid: string, extraModifiers: Modifier[] = []): ComputedStats {
  const card = cardOf(catalog, state, iid);
  const inst = state.instances[iid]!;
  const mods = [...inst.modifiers, ...extraModifiers];
  const dAtk = mods.reduce((s, m) => s + m.atk, 0);
  const dHp = mods.reduce((s, m) => s + m.hp, 0);
  const sources = mods.map((m) => ({ source: m.source, label: m.label, atk: m.atk, hp: m.hp }));

  if (Array.isArray(card.hp) && Array.isArray(card.atk) && inst.bodyDamage) {
    const bodies = card.hp.map((h, i) => {
      const maxHp = Math.max(0, h + dHp);
      const hp = Math.max(0, maxHp - (inst.bodyDamage![i] ?? 0));
      return { hp, atk: Math.max(0, (card.atk as number[])[i]! + dAtk), alive: hp > 0 };
    });
    const alive = bodies.filter((b) => b.alive);
    const baseHp = card.hp.reduce((a, b) => a + b, 0);
    const baseAtk = card.atk.reduce((a, b) => a + b, 0);
    return {
      atk: alive[0]?.atk ?? 0,
      hp: alive.reduce((s, b) => s + b.hp, 0),
      maxHp: card.hp.reduce((s, h) => s + Math.max(0, h + dHp), 0),
      baseAtk,
      baseHp,
      sources,
      bodies,
    };
  }

  const baseHp = typeof card.hp === 'number' ? card.hp : 0;
  const baseAtk = typeof card.atk === 'number' ? card.atk : 0;
  const maxHp = Math.max(0, baseHp + dHp);
  return { atk: Math.max(0, baseAtk + dAtk), hp: Math.max(0, maxHp - inst.damage), maxHp, baseAtk, baseHp, sources };
}

/** GDD: damage is rounded down to the nearest ten after reductions. */
export function roundDamage(amount: number): number {
  return Math.max(0, Math.floor(amount / RULES.DAMAGE_ROUNDING) * RULES.DAMAGE_ROUNDING);
}
