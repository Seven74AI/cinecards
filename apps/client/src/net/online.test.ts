import { describe, expect, it, vi } from 'vitest';
import { DECK_REFUSED_CODE } from '@cinecards/protocol';
import { joinErrorMessage, watchSeatToken } from './online.ts';

/** Mimics @colyseus/sdk 0.18: `onReconnect` listeners run before the new token is stored. */
function fakeRoom() {
  const listeners: (() => void)[] = [];
  const room = {
    roomId: 'ABCDE',
    reconnectionToken: 'ABCDE:first',
    onReconnect: (cb: () => void) => void listeners.push(cb),
    reconnect(next: string) {
      listeners.forEach((cb) => cb());
      room.reconnectionToken = next; // stored in the SDK's `finally`, after the listeners
    },
  };
  return room;
}

describe('11.2 seat token after an automatic reconnection', () => {
  it('saves the token issued by the reconnection, not the one the server just discarded', () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const room = fakeRoom();
    watchSeatToken(room as never, (_code, token) => saved.push(token));
    expect(saved).toEqual(['ABCDE:first']);
    room.reconnect('ABCDE:second');
    vi.runAllTimers();
    room.reconnect('ABCDE:third');
    vi.runAllTimers();
    expect(saved).toEqual(['ABCDE:first', 'ABCDE:second', 'ABCDE:third']);
    vi.useRealTimers();
  });

  it('the check run on every view saves only a changed token', () => {
    const saved: string[] = [];
    const room = fakeRoom();
    const remember = watchSeatToken(room as never, (_code, token) => saved.push(token));
    remember();
    room.reconnectionToken = 'ABCDE:later';
    remember();
    remember();
    expect(saved).toEqual(['ABCDE:first', 'ABCDE:later']);
  });
});

describe('joinErrorMessage (story 10.3)', () => {
  it('shows the French refusal of a constructed room as written by the server', () => {
    const msg = 'Cette salle se joue en decks construits : connecte-toi et construis un deck valide.';
    expect(joinErrorMessage(Object.assign(new Error(msg), { code: DECK_REFUSED_CODE }), false)).toBe(msg);
    // any other error keeps its usual words
    expect(joinErrorMessage(Object.assign(new Error('room "X" not found'), { code: 4212 }), false)).toMatch(/Aucune salle/);
  });
});
