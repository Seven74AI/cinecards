/** mulberry32 — tiny deterministic PRNG. The state lives in GameState.rng. */
export function nextRandom(rng: number): { value: number; rng: number } {
  let t = (rng + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rng: next };
}

/** Mutating helpers operating on an object that owns an `rng` field. */
export function randomInt(holder: { rng: number }, maxExclusive: number): number {
  const r = nextRandom(holder.rng);
  holder.rng = r.rng;
  return Math.floor(r.value * maxExclusive);
}

export function shuffleInPlace<T>(holder: { rng: number }, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(holder, i + 1);
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

export function rollD6(holder: { rng: number }): number {
  return randomInt(holder, 6) + 1;
}
