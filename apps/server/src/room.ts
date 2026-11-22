import { Room, type Client } from '@colyseus/core';
import { RULES, type Action, type Catalog, type DeckMode, type PlayerId } from '@cinecards/engine';
import type { AwayMessage, LobbyMessage, RoomOptions } from '@cinecards/protocol';
import { Duel } from './duel.ts';
import { uniqueCode } from './codes.ts';

const usedCodes = new Set<string>();

/** Catalog injected at startup (main.ts) so the room stays free of file-system code. */
export const roomConfig: { catalog: Catalog | null; turnMs?: number; reactionMs?: number; reconnectSeconds?: number } = { catalog: null };

const cleanName = (n: unknown, fallback: string) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 16) : fallback);

/** A private 1v1 room joined by code or link (stories 6.1, 6.2, 6.6). */
export class DuelRoom extends Room {
  maxClients = 2;
  private mode: DeckMode = 'shared';
  private seats: [Client | null, Client | null] = [null, null];
  private names: [string, string] = ['Joueur 1', 'Joueur 2'];
  private duel: Duel | null = null;

  onCreate(options: RoomOptions) {
    this.roomId = uniqueCode((c) => usedCodes.has(c));
    usedCodes.add(this.roomId);
    this.mode = options?.mode === 'randomSplit' ? 'randomSplit' : 'shared';
    this.onMessage('action', (client: Client, action: Action) => {
      const seat = this.seatOf(client);
      if (seat === null || !this.duel || !action || typeof action !== 'object') return;
      this.duel.act(seat, action);
      if (this.duel.finished) this.unlock();
    });
  }

  onJoin(client: Client, options: RoomOptions) {
    const seat: PlayerId = this.seats[0] ? 1 : 0;
    this.seats[seat] = client;
    this.names[seat] = cleanName(options?.nickname, seat === 0 ? 'Joueur 1' : 'Joueur 2');
    this.sendLobby();
    if (this.seats[0] && this.seats[1] && !this.duel) this.startDuel();
  }

  async onDrop(client: Client) {
    const seat = this.seatOf(client);
    if (seat === null || !this.duel || this.duel.finished) return;
    const seconds = roomConfig.reconnectSeconds ?? RULES.RECONNECT_SECONDS;
    this.away({ player: seat, until: Date.now() + seconds * 1000 });
    try {
      const back = await this.allowReconnection(client, seconds);
      this.seats[seat] = back;
      this.away({ player: seat, until: null });
      this.duel.resend(seat);
    } catch {
      this.duel?.concede(seat);
    }
  }

  onReconnect(client: Client) {
    const seat = this.seatOf(client);
    if (seat !== null && this.duel) this.duel.resend(seat);
  }

  onLeave(client: Client) {
    const seat = this.seatOf(client);
    if (seat === null) return;
    if (this.duel && !this.duel.finished) this.duel.concede(seat);
    if (!this.duel) {
      this.seats[seat] = null;
      this.sendLobby();
    }
  }

  onDispose() {
    usedCodes.delete(this.roomId);
    this.duel?.dispose();
  }

  private seatOf(client: Client): PlayerId | null {
    const i = this.seats.findIndex((c) => c?.sessionId === client.sessionId);
    return i < 0 ? null : (i as PlayerId);
  }

  private sendLobby() {
    this.seats.forEach((c, you) => {
      const msg: LobbyMessage = { code: this.roomId, seats: [this.seats[0] ? this.names[0] : null, this.seats[1] ? this.names[1] : null], you: you as PlayerId, mode: this.mode };
      c?.send('lobby', msg);
    });
  }

  private away(msg: AwayMessage) {
    this.seats.forEach((c) => c?.send('away', msg));
  }

  private startDuel() {
    if (!roomConfig.catalog) throw new Error('catalog not configured');
    this.lock();
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.duel = new Duel(
      roomConfig.catalog,
      { seed, mode: this.mode },
      this.names,
      {
        view: (p, msg) => this.seats[p]?.send('view', msg),
        rejected: (p, err) => this.seats[p]?.send('rejected', err),
      },
      undefined,
      roomConfig.turnMs,
      roomConfig.reactionMs,
    );
  }
}
