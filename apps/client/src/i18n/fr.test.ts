import { describe, expect, it } from 'vitest';
import { fr } from './fr.ts';

describe('french error messages', () => {
  it('formats the coins refusal', () => {
    expect(fr.errors.NOT_ENOUGH_COINS({ cost: 7, coins: 4 })).toBe('Pas assez de pièces : 7 requises, 4 en stock.');
  });
});
