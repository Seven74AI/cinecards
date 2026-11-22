import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiUrl, formatRecoveryCode } from './api.ts';
import { readStored, writeStored } from './session.ts';

describe('8.1 account client', () => {
  it('derives the HTTP API from the WebSocket server URL', () => {
    expect(apiUrl('ws://localhost:2567')).toBe('http://localhost:2567');
    expect(apiUrl('wss://cinecards.sevend.io')).toBe('https://cinecards.sevend.io');
    expect(apiUrl('wss://cinecards.sevend.io/')).toBe('https://cinecards.sevend.io');
  });

  it('shows a typed recovery code in groups of 4 capitals', () => {
    expect(formatRecoveryCode('abcd efgh-jkmn pqrs')).toBe('ABCD-EFGH-JKMN-PQRS');
    expect(formatRecoveryCode('abcde')).toBe('ABCD-E');
    expect(formatRecoveryCode('ABCD')).toBe('ABCD');
    expect(formatRecoveryCode('ABCD-EFGH-JKMN-PQRS-XTRA')).toBe('ABCD-EFGH-JKMN-PQRS');
  });

  describe('session storage', () => {
    const store = new Map<string, string>();
    beforeEach(() => {
      store.clear();
      (globalThis as { localStorage?: unknown }).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      };
    });
    afterEach(() => {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    });

    it('keeps the token, nickname and id under cinecards.account, and forgets them', () => {
      writeStored({ token: 't0k', nickname: 'Léa', id: 3 });
      expect(JSON.parse(store.get('cinecards.account')!)).toEqual({ token: 't0k', nickname: 'Léa', id: 3 });
      expect(readStored()).toEqual({ token: 't0k', nickname: 'Léa', id: 3 });
      writeStored(null);
      expect(store.has('cinecards.account')).toBe(false);
      expect(readStored()).toBeNull();
    });

    it('ignores broken or partial data', () => {
      store.set('cinecards.account', '{not json');
      expect(readStored()).toBeNull();
      store.set('cinecards.account', JSON.stringify({ token: 'x' }));
      expect(readStored()).toBeNull();
    });

    it('survives a missing localStorage', () => {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      expect(readStored()).toBeNull();
      expect(() => writeStored({ token: 'a', nickname: 'b', id: 1 })).not.toThrow();
    });
  });
});
