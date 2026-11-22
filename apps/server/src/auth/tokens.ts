import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ALPHABET } from '../codes.ts';

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/** Session token: 32 random bytes in base64url. Only its SHA-256 is stored. */
export const newSessionToken = () => randomBytes(32).toString('base64url');

/** Recovery code: 16 characters without look-alikes (~79 bits), shown as `XXXX-XXXX-XXXX-XXXX`. */
export function newRecoveryCode(): string {
  let s = '';
  for (let i = 0; i < 16; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s.match(/.{4}/g)!.join('-');
}

/** Dashes, spaces and case do not matter when a code is typed back. */
export const recoveryKey = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const hashRecoveryCode = (code: string) => sha256(recoveryKey(code));

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
