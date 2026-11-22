import { describe, expect, it } from 'vitest';
import { ROOM_NAME } from './index.ts';

describe('protocol', () => {
  it('names the duel room', () => expect(ROOM_NAME).toBe('duel'));
});
