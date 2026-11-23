import { describe, expect, it } from 'vitest';
import { getHandView, HAND_VIEW_KEY, handViewFromSearch, loadHandView, parseHandView, setHandView, subscribeHandView } from './handView.ts';

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

describe('14.3 view of the open hand', () => {
  it('is compact by default, and when the saved value is unknown or the storage fails', () => {
    expect(loadHandView(memory(), null)).toBe('compact');
    expect(loadHandView(null, null)).toBe('compact');
    expect(loadHandView(memory({ [HAND_VIEW_KEY]: 'huge' }), null)).toBe('compact');
    const broken = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: () => {},
    };
    expect(loadHandView(broken, null)).toBe('compact');
  });

  it('reads the saved choice; a forced one (?handView=… on the dev server) wins', () => {
    expect(loadHandView(memory({ [HAND_VIEW_KEY]: 'detailed' }), null)).toBe('detailed');
    expect(loadHandView(memory({ [HAND_VIEW_KEY]: 'detailed' }), 'compact')).toBe('compact');
    expect(handViewFromSearch('?scene=pleine&handView=detailed')).toBe('detailed');
    expect(handViewFromSearch('?scene=pleine')).toBeNull();
    expect(parseHandView('compact')).toBe('compact');
    expect(parseHandView('Detailed')).toBeNull();
  });

  it('a change is kept on the device and tells the listeners', () => {
    const store = memory();
    let calls = 0;
    const off = subscribeHandView(() => calls++);
    setHandView('detailed', store);
    expect(store.data.get(HAND_VIEW_KEY)).toBe('detailed');
    expect(getHandView()).toBe('detailed');
    expect(calls).toBe(1);
    off();
    setHandView('compact', store);
    expect(calls).toBe(1);
    expect(getHandView()).toBe('compact');
    expect(loadHandView(store, null)).toBe('compact');
  });
});
