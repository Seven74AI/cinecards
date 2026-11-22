/**
 * Failed-attempt limit (story 8.1): a sliding window in memory, 10 failures per 15 min per nickname key,
 * shared by login and recovery. A success does not clear recent failures.
 */
export class Limiter {
  private fails = new Map<string, number[]>();
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(now: () => number = Date.now, max = 10, windowMs = 15 * 60 * 1000) {
    this.now = now;
    this.max = max;
    this.windowMs = windowMs;
  }

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs;
    const list = (this.fails.get(key) ?? []).filter((t) => t > since);
    if (list.length) this.fails.set(key, list);
    else this.fails.delete(key);
    return list;
  }

  /** Milliseconds until the next attempt is allowed; 0 when it is allowed now. */
  retryAfterMs(key: string): number {
    const list = this.recent(key);
    if (list.length < this.max) return 0;
    return list[list.length - this.max]! + this.windowMs - this.now();
  }

  fail(key: string) {
    const list = this.recent(key);
    list.push(this.now());
    this.fails.set(key, list);
    if (this.fails.size > 10_000) this.prune();
  }

  private prune() {
    for (const key of [...this.fails.keys()]) this.recent(key);
  }
}
