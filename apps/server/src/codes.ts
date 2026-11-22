/** Room codes (story 6.2): 5 characters without look-alikes (no 0/O, 1/I/L). */
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function roomCode(random: () => number = Math.random, length = 5): string {
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

export function uniqueCode(taken: (code: string) => boolean, random: () => number = Math.random): string {
  for (let i = 0; i < 1000; i++) {
    const c = roomCode(random);
    if (!taken(c)) return c;
  }
  throw new Error('no free room code');
}
