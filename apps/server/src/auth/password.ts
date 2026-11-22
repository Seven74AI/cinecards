import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 64;

/** Asynchronous scrypt, so hashing never blocks the rooms' event loop. */
const derive = (password: string, salt: Buffer, keyLen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password.normalize('NFC'), salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key))));

/** `scrypt$N$r$p$saltBase64$hashBase64`, with a random 16-byte salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  if (!expected.length) return false;
  const key = await derive(password, salt, expected.length, { N, r, p });
  return timingSafeEqual(key, expected);
}

const DUMMY = Buffer.alloc(16);
/** Spends the same time as a real check, for unknown nicknames (no timing hint that a nickname exists). */
export const dummyVerify = async (password: string) => void (await derive(password, DUMMY, KEY_LEN, PARAMS));
