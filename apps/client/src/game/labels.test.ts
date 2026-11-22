import { describe, expect, it } from 'vitest';
import { abilityBody, abilityTag } from './labels.ts';

describe('ability trigger labels (story 11.7)', () => {
  it('labels each kind of ability', () => {
    expect(abilityTag({ category: 'character' }, { kind: 'attack' }).label).toBe('Attaque spéciale');
    expect(abilityTag({ category: 'character' }, { kind: 'onPlay' }).label).toBe("À l'arrivée");
    expect(abilityTag({ category: 'terrain' }, { kind: 'passive' }).label).toBe('Passif');
    expect(abilityTag({ category: 'spell' }, { kind: 'active' }).label).toBe('Effet');
    expect(abilityTag({ category: 'spell' }, { kind: 'choice' }).label).toBe('Effet');
    expect(abilityTag({ category: 'character' }, { kind: 'startOfTurn' }).label).toBe('Début de votre tour');
  });

  it('drops the trigger words the label already shows', () => {
    expect(abilityBody({ category: 'character' }, { kind: 'onPlay', text: "À l'arrivée : vous piochez 3 cartes." })).toBe('Vous piochez 3 cartes.');
    expect(abilityBody({ category: 'character' }, { kind: 'attack', text: 'Attaque : réduit au silence un personnage.' })).toBe('Réduit au silence un personnage.');
    expect(abilityBody({ category: 'character' }, { kind: 'attack', text: 'Attaque, usage unique : vous absorbez.' })).toBe('Usage unique : vous absorbez.');
    expect(abilityBody({ category: 'character' }, { kind: 'attack', text: 'Attaque spéciale : réduit.' })).toBe('Réduit.');
    expect(abilityBody({ category: 'spell' }, { kind: 'active', text: 'Inflige 120 dégâts.' })).toBe('Inflige 120 dégâts.');
  });
});
