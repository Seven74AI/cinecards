import type { Presence } from '@cinecards/protocol';

/**
 * Who is connected, in memory (story 8.3). `online` counts the account's hub connections (several tabs or devices);
 * `inGame` is set by each duel room the account plays in, keyed by room code, so a room can only clear its own flag.
 * One server process, so this is the whole truth; a restart starts everyone offline until their client reconnects.
 */
export class PresenceRegistry {
  private connections = new Map<number, number>();
  private games = new Map<number, Set<string>>();
  private listeners = new Set<(accountId: number, presence: Presence) => void>();

  of(accountId: number): Presence {
    if (this.games.get(accountId)?.size) return 'inGame';
    return this.connections.get(accountId) ? 'online' : 'offline';
  }

  /** Called with the new presence each time an account's presence changes. */
  onChange(fn: (accountId: number, presence: Presence) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  online(accountId: number) {
    this.change(accountId, () => this.connections.set(accountId, (this.connections.get(accountId) ?? 0) + 1));
  }

  offline(accountId: number) {
    this.change(accountId, () => {
      const n = (this.connections.get(accountId) ?? 0) - 1;
      if (n > 0) this.connections.set(accountId, n);
      else this.connections.delete(accountId);
    });
  }

  inGame(accountId: number, playing: boolean, roomCode: string) {
    this.change(accountId, () => {
      const set = this.games.get(accountId) ?? new Set<string>();
      if (playing) set.add(roomCode);
      else set.delete(roomCode);
      if (set.size) this.games.set(accountId, set);
      else this.games.delete(accountId);
    });
  }

  private change(accountId: number, mutate: () => void) {
    const before = this.of(accountId);
    mutate();
    const after = this.of(accountId);
    if (after !== before) this.listeners.forEach((l) => l(accountId, after));
  }
}
