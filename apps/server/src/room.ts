import { Room, ServerError, type Client } from '@colyseus/core';
import { RULES, type Action, type Catalog, type DeckMode, type PlayerId } from '@cinecards/engine';
import { DECK_REFUSED_CODE, EMOTE_COOLDOWN_MS, isEmoteId, type AwayMessage, type DeckRefusedMessage, type EmoteMessage, type LobbyMessage, type RoomOptions } from '@cinecards/protocol';
import { Duel } from './duel.ts';
import { uniqueCode } from './codes.ts';
import type { FinishedDuel } from './history.ts';
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
  /** Story 8.4: records each finished duel (a game between two guests is dropped there); null = no history. */
  history?: { record(game: FinishedDuel): unknown } | null;
  /** Story 10.3: the saved decks a seat may play in a constructed room; null = no constructed rooms (they fall back to `shared`). */
  decks?: {
    playDeck(accountId: number, deckId: unknown): { ok: true; cards: string[] } | { ok: false; message: string };
    hasPlayDeck(accountId: number): boolean;
  } | null;
  /** Clock of the emote rate limit (story 8.5), injectable for tests. */
  now?: () => number;
} = { catalog: null };

/** An empty waiting room stays joinable this long after its last player left (story 11.2). */
export const LOBBY_TTL_MS = 10 * 60 * 1000;

/** Story 10.3: player-facing refusals of a constructed room (French, tutoiement). */
export const CONSTRUCTED_MESSAGES = {
  /** Someone who cannot play here: a guest, an account without a valid deck, or an older client that cannot choose one. */
  join: 'Cette salle se joue en decks construits : connecte-toi et construis un deck valide.',
  signIn: 'Connecte-toi pour créer une salle en decks construits.',
} as const;

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
  /** Story 10.3, constructed rooms: the saved deck chosen by each seat; read again and frozen when the duel starts. */
  private deckIds: [number | null, number | null] = [null, null];
  /** Someone has held a seat here: the first join is the creator's. */
  private everSeated = false;

  onCreate(options: RoomOptions) {
    this.roomId = uniqueCode((c) => usedCodes.has(c));
    usedCodes.add(this.roomId);
    openRooms.set(this.roomId, this);
    // story 10.3: older clients only send `shared` / `randomSplit`; `constructed` needs the server's saved decks
    this.mode = options?.mode === 'constructed' && roomConfig.decks ? 'constructed' : options?.mode === 'randomSplit' ? 'randomSplit' : 'shared';
    this.onMessage('action', (client: Client, action: Action) => {
      const seat = this.seatOf(client);
      if (seat === null || !this.duel || !action || typeof action !== 'object') return;
      this.duel.act(seat, action);
    });
    this.onMessage('emote', (client: Client, msg: { id?: unknown }) => this.emote(client, msg));
    this.onMessage('chooseDeck', (client: Client, msg: { deckId?: unknown }) => this.chooseDeck(client, msg));
    // the creator joins right away; this only matters if that join fails
    this.armExpiry();
  }

  onJoin(client: Client, options: RoomOptions) {
    this.clearExpiry();
    const seat: PlayerId = this.seats[0] ? 1 : 0;
    // a valid session token names the seat after its account; anything else joins as a guest (story 8.1)
    const account = options?.session ? (roomConfig.accounts?.accountOf(options.session) ?? null) : null;
    const deckId = this.mode === 'constructed' ? this.joinDeck(account?.id ?? null, options) : null;
    this.everSeated = true;
    this.seats[seat] = client;
    this.names[seat] = account ? account.nickname : cleanName(options?.nickname, seat === 0 ? 'Joueur 1' : 'Joueur 2');
    this.accounts[seat] = account ? account.id : null;
    this.deckIds[seat] = deckId;
    this.sendLobby();
    this.maybeStart();
  }

  /**
   * Story 10.3: who may sit in a constructed room, before taking a seat. The creator brings a valid deck; a later
   * player is signed in, and either brings a valid deck or can choose one in the waiting room (`pickDeck`, which an
   * older client does not send) and has one. Throws a French refusal otherwise. Returns the deck already chosen.
   */
  private joinDeck(accountId: number | null, options: RoomOptions): number | null {
    const creating = !this.everSeated;
    const refuse = (message: string): never => {
      // a refused creation leaves an empty room nobody knows the code of
      if (creating) setTimeout(() => void this.disconnect(), 0);
      throw new ServerError(DECK_REFUSED_CODE, message);
    };
    if (accountId === null || !roomConfig.decks) return refuse(creating ? CONSTRUCTED_MESSAGES.signIn : CONSTRUCTED_MESSAGES.join);
    const deckId = options?.deckId;
    if (deckId !== undefined) {
      const deck = roomConfig.decks.playDeck(accountId, deckId);
      if (deck.ok) return deckId;
      if (creating) return refuse(deck.message);
    }
    if (creating || !options?.pickDeck || !roomConfig.decks.hasPlayDeck(accountId)) return refuse(CONSTRUCTED_MESSAGES.join);
    return null;
  }

  /** Story 10.3: a seated player of a constructed room picks (or changes) their deck before the duel. */
  private chooseDeck(client: Client, msg: { deckId?: unknown }) {
    const seat = this.seatOf(client);
    const accountId = seat === null ? null : this.accounts[seat];
    if (seat === null || this.duel || this.mode !== 'constructed' || !roomConfig.decks) return;
    const deck = accountId === null ? ({ ok: false, message: CONSTRUCTED_MESSAGES.join } as const) : roomConfig.decks.playDeck(accountId, msg?.deckId);
    if (!deck.ok) {
      this.refuseDeck(seat, deck.message);
      return;
    }
    this.deckIds[seat] = msg.deckId as number;
    this.sendLobby();
    this.maybeStart();
  }

  private refuseDeck(seat: PlayerId, message: string) {
    const out: DeckRefusedMessage = { message };
    this.seats[seat]?.send('deckRefused', out);
  }

  /** Starts the duel once both seats are taken (and, in a constructed room, both decks chosen). */
  private maybeStart() {
    if (!this.seats[0] || !this.seats[1] || this.duel) return;
    if (this.mode !== 'constructed') {
      this.startDuel();
      return;
    }
    if (this.deckIds[0] === null || this.deckIds[1] === null) return;
    // read and checked once more now: this copy is the one the duel plays, whatever happens to the saved deck later
    const decks: string[][] = [];
    for (const seat of [0, 1] as const) {
      const deck = roomConfig.decks?.playDeck(this.accounts[seat] ?? -1, this.deckIds[seat]) ?? { ok: false as const, message: CONSTRUCTED_MESSAGES.join };
      if (!deck.ok) {
        this.deckIds[seat] = null;
        this.refuseDeck(seat, deck.message);
        this.sendLobby();
        return;
      }
      decks.push(deck.cards);
    }
    this.startDuel([decks[0]!, decks[1]!]);
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
        this.deckIds[seat] = null;
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

  /** Story 8.4: the finished duel goes to the history, with each seat's account and name; results come from the engine. */
  private recordGame(duel: Duel) {
    if (duel.state.winner === null || (this.accounts[0] === null && this.accounts[1] === null)) return;
    roomConfig.history?.record({
      mode: this.mode,
      turns: duel.turns,
      startedAt: duel.startedAt,
      endedAt: Date.now(),
      accounts: [this.accounts[0], this.accounts[1]],
      names: [this.names[0], this.names[1]],
      winner: duel.state.winner,
      concededBy: duel.concededBy,
    });
  }

  /** Account id of a seat, or null for a guest. */
  accountOf(seat: PlayerId): number | null {
    return this.accounts[seat];
  }

  private seatOf(client: Client): PlayerId | null {
    const i = this.seats.findIndex((c) => c?.sessionId === client.sessionId);
    return i < 0 ? null : (i as PlayerId);
  }

  /** Story 8.5: relays a known emote to both seats, at most one per seat every 3 s, once the duel has started. */
  private lastEmote: [number, number] = [-Infinity, -Infinity];
  private emote(client: Client, msg: { id?: unknown }) {
    const seat = this.seatOf(client);
    const id = msg?.id;
    if (seat === null || !this.duel || !isEmoteId(id)) return;
    const now = (roomConfig.now ?? Date.now)();
    if (now - this.lastEmote[seat] < EMOTE_COOLDOWN_MS) return;
    this.lastEmote[seat] = now;
    const out: EmoteMessage = { from: seat, id };
    this.seats.forEach((c) => c?.send('emote', out));
  }

  private sendLobby() {
    this.seats.forEach((c, you) => {
      const msg: LobbyMessage = { code: this.roomId, seats: [this.seats[0] ? this.names[0] : null, this.seats[1] ? this.names[1] : null], you: you as PlayerId, mode: this.mode };
      if (this.mode === 'constructed') {
        // story 10.3: only whether a deck is chosen, never which cards
        msg.needDeck = this.deckIds[you] === null;
        msg.deckChosen = [this.deckIds[0] !== null, this.deckIds[1] !== null];
        msg.deckId = this.deckIds[you];
      }
      c?.send('lobby', msg);
    });
  }

  private away(msg: AwayMessage) {
    this.seats.forEach((c) => c?.send('away', msg));
  }

  private startDuel(decks?: [string[], string[]]) {
    if (!roomConfig.catalog) throw new Error('catalog not configured');
    this.lock();
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.duel = new Duel(
      roomConfig.catalog,
      { seed, mode: this.mode, ...(decks ? { decks } : {}) },
      this.names,
      {
        view: (p, msg) => {
          this.seats[p]?.send('view', msg);
          if (this.duel?.finished && this.playing.length) this.leaveGame();
        },
        rejected: (p, err) => this.seats[p]?.send('rejected', err),
        ended: (duel) => this.recordGame(duel),
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
