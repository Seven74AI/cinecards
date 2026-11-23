import { Room, type Client } from '@colyseus/core';
import { RULES, type Action, type Catalog, type DeckMode, type PlayerId } from '@cinecards/engine';
import type { AwayMessage, LobbyMessage, RoomOptions } from '@cinecards/protocol';
import { Duel } from './duel.ts';
import { uniqueCode } from './codes.ts';
import type { PresenceRegistry } from './presence.ts';
import type { RoomSummary } from './social/invites.ts';

const usedCodes = new Set<string>();
/** Open duel rooms by code (story 8.3: an invitation checks its room). One server process, so a local map is enough. */
const openRooms = new Map<string, DuelRoom>();

/** The room behind a code, as the invitation service sees it; null when no such room is open. */
export const findDuelRoom = (code: string): RoomSummary | null => openRooms.get(code)?.summary() ?? null;

/** Catalog injected at startup (main.ts) so the room stays free of file-system code. */
export const roomConfig: {
  catalog: Catalog | null;
  /** Session lookup (story 8.1), injected at startup like the catalog; null = guests only. */
  accounts?: { accountOf(token: unknown): { id: number; nickname: string } | null } | null;
  turnMs?: number;
  reactionMs?: number;
  reconnectSeconds?: number;
  lobbyTtlMs?: number;
  /** Story 8.3: "en partie" presence of the seated accounts, and the invitations to cancel when a room starts or goes. */
  presence?: Pick<PresenceRegistry, 'inGame'> | null;
  invites?: { roomStarted(code: string): void; roomGone(code: string): void } | null;
} = { catalog: null };

/** An empty waiting room stays joinable this long after its last player left (story 11.2). */
export const LOBBY_TTL_MS = 10 * 60 * 1000;

const cleanName = (n: unknown, fallback: string) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 16) : fallback);

/**
 * A private 1v1 room joined by code or link (stories 6.1, 6.2, 6.6, 11.2).
 * Leaving a running duel, voluntarily or not, keeps the seat for 90 s; only the `concede` action forfeits.
 */
export class DuelRoom extends Room {
  maxClients = 2;
  autoDispose = false;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  private mode: DeckMode = 'shared';
  private seats: [Client | null, Client | null] = [null, null];
  private names: [string, string] = ['Joueur 1', 'Joueur 2'];
  /** Account id of each seat, null for a guest (story 8.1; used by the history, story 8.4). */
  private accounts: [number | null, number | null] = [null, null];
  private duel: Duel | null = null;
  /** Accounts flagged "en partie" by this room (story 8.3), cleared when the duel ends or the room goes. */
  private playing: number[] = [];

  onCreate(options: RoomOptions) {
    this.roomId = uniqueCode((c) => usedCodes.has(c));
    usedCodes.add(this.roomId);
    openRooms.set(this.roomId, this);
    this.mode = options?.mode === 'randomSplit' ? 'randomSplit' : 'shared';
    this.onMessage('action', (client: Client, action: Action) => {
      const seat = this.seatOf(client);
      if (seat === null || !this.duel || !action || typeof action !== 'object') return;
      this.duel.act(seat, action);
    });
    // the creator joins right away; this only matters if that join fails
    this.armExpiry();
  }

  onJoin(client: Client, options: RoomOptions) {
    this.clearExpiry();
    const seat: PlayerId = this.seats[0] ? 1 : 0;
    this.seats[seat] = client;
    // a valid session token names the seat after its account; anything else joins as a guest (story 8.1)
    const account = options?.session ? (roomConfig.accounts?.accountOf(options.session) ?? null) : null;
    this.names[seat] = account ? account.nickname : cleanName(options?.nickname, seat === 0 ? 'Joueur 1' : 'Joueur 2');
    this.accounts[seat] = account ? account.id : null;
    this.sendLobby();
    if (this.seats[0] && this.seats[1] && !this.duel) this.startDuel();
  }

  onReconnect(client: Client) {
    this.clearExpiry();
    const seat = this.seatOf(client);
    if (seat !== null && this.duel) this.duel.resend(seat);
  }

  /** Called for consented leaves and drops alike (no `onDrop`), so "Quitter" and a lost connection behave the same. */
  async onLeave(client: Client) {
    const seat = this.seatOf(client);
    if (seat !== null) {
      if (this.duel && !this.duel.finished) await this.holdSeat(client, seat);
      else if (!this.duel) {
        this.seats[seat] = null;
        this.accounts[seat] = null;
        this.sendLobby();
        // the creator left the waiting room: invitations to it are pointless now
        if (seat === 0) roomConfig.invites?.roomGone(this.roomId);
      }
    }
    this.armExpiry();
  }

  private async holdSeat(client: Client, seat: PlayerId) {
    const seconds = roomConfig.reconnectSeconds ?? RULES.RECONNECT_SECONDS;
    this.away({ player: seat, until: Date.now() + seconds * 1000 });
    try {
      const back = await this.allowReconnection(client, seconds);
      this.seats[seat] = back;
      this.away({ player: seat, until: null });
      this.duel?.resend(seat);
    } catch {
      this.duel?.concede(seat);
    }
  }

  /** Disposes the room once nobody can come back: a finished duel at once, an empty lobby after 10 min. */
  private armExpiry() {
    if (this.clients.length > 0) return;
    if (this.duel && !this.duel.finished) return; // seats are still reserved
    this.clearExpiry();
    if (this.duel) {
      void this.disconnect();
      return;
    }
    this.expiry = setTimeout(() => void this.disconnect(), roomConfig.lobbyTtlMs ?? LOBBY_TTL_MS);
  }

  private clearExpiry() {
    if (this.expiry) clearTimeout(this.expiry);
    this.expiry = null;
  }

  onDispose() {
    this.clearExpiry();
    usedCodes.delete(this.roomId);
    if (openRooms.get(this.roomId) === this) openRooms.delete(this.roomId);
    this.duel?.dispose();
    this.leaveGame();
    roomConfig.invites?.roomGone(this.roomId);
  }

  /** What an invitation needs to know (story 8.3). */
  summary(): RoomSummary {
    return { creator: this.seats[0] ? this.accounts[0] : null, waiting: !this.duel && !this.locked && !this.seats[1], mode: this.mode };
  }

  /** Clears the "en partie" presence this room set. */
  private leaveGame() {
    for (const id of this.playing) roomConfig.presence?.inGame(id, false, this.roomId);
    this.playing = [];
  }

  /** Account id of a seat, or null for a guest. */
  accountOf(seat: PlayerId): number | null {
    return this.accounts[seat];
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
        view: (p, msg) => {
          this.seats[p]?.send('view', msg);
          if (this.duel?.finished && this.playing.length) this.leaveGame();
        },
        rejected: (p, err) => this.seats[p]?.send('rejected', err),
      },
      undefined,
      roomConfig.turnMs,
      roomConfig.reactionMs,
    );
    this.playing = this.accounts.filter((a): a is number => a !== null);
    for (const id of this.playing) roomConfig.presence?.inGame(id, true, this.roomId);
    roomConfig.invites?.roomStarted(this.roomId);
  }
}
