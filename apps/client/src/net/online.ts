import { Client, type Room } from '@colyseus/sdk';
import { createGame, type Action, type Catalog, type DeckMode } from '@cinecards/engine';
import { ROOM_NAME, type AwayMessage, type LobbyMessage, type RuleError, type ViewMessage } from '@cinecards/protocol';
import { appendLog, Store, type Session } from '../game/session.ts';

import { forgetSeat, saveSeat, seatToken, SERVER_URL } from './config.ts';

export type OnlineStart = { create: true; mode: DeckMode; nickname: string } | { create: false; code: string; nickname: string } | { reconnect: string };

/** Player-facing join errors (story 11.2): not found, full, and a seat that can no longer be resumed are told apart. */
export function joinErrorMessage(err: unknown, hadSeat: boolean): string {
  const msg = String((err as Error)?.message ?? err);
  if (/not found|disposed/i.test(msg)) return hadSeat ? 'Cette partie est terminée : la salle n’existe plus.' : 'Aucune salle ne porte ce code. Vérifie-le : une salle d’attente expire 10 min après le départ de tous ses joueurs.';
  if (/locked|full/i.test(msg))
    return hadSeat
      ? 'Ta place n’est plus réservée : le délai de 90 s est dépassé, ou la partie est déjà ouverte dans un autre onglet.'
      : 'Cette salle est complète : une partie y est en cours. Si c’est la tienne, rouvre-la depuis le même navigateur dans les 90 s.';
  if (/expired|invalid/i.test(msg)) return 'Ta place n’est plus réservée : le délai de 90 s est dépassé ou la partie est terminée.';
  return 'Connexion au serveur impossible. Vérifie le code ou réessaie plus tard.';
}

/**
 * Turns the server's remaining time into a deadline on this device's clock, so a skewed clock does not
 * shift the countdown (story 11.3). Older servers only send the absolute time.
 */
export const localDeadline = (msLeft: number | null | undefined, endsAt: number | null, now = Date.now()): number | null =>
  msLeft === undefined ? endsAt : msLeft === null ? null : now + msLeft;

const codeOfToken = (token: string) => token.split(':')[0] ?? '';

/** Online duel through the Colyseus server (stories 6.1–6.6, 11.2). The engine runs on the server; we only render views. */
export function onlineSession(catalog: Catalog, start: OnlineStart, onFatal: (message: string) => void): Session {
  const placeholder = createGame(catalog, { seed: 1, autoStart: false }).state;
  const store = new Store({
    state: placeholder,
    events: [],
    seq: 0,
    log: [],
    error: null,
    viewer: 0,
    names: ['Toi', 'Adversaire'],
    turnEndsAt: null,
    reactionEndsAt: null,
    status: 'connecting',
  });
  let room: Room | null = null;
  let disposed = false;
  const client = new Client(SERVER_URL);

  const remember = (r: Room) => {
    if (r.reconnectionToken) saveSeat(r.roomId, r.reconnectionToken);
  };

  const wire = (r: Room) => {
    room = r;
    remember(r);
    r.onMessage('lobby', (m: LobbyMessage) => {
      store.set({ roomCode: m.code, seats: m.seats, viewer: m.you, status: store.snap.status === 'connecting' ? 'waiting' : store.snap.status });
    });
    r.onMessage('view', (m: ViewMessage) => {
      const seq = m.seq;
      store.set({
        state: m.view.state,
        events: m.events,
        seq,
        log: m.events.length ? appendLog(store.snap, m.events, m.view.state, seq) : store.snap.log,
        viewer: m.view.you,
        names: m.view.names,
        turnEndsAt: localDeadline(m.turnMsLeft, m.turnEndsAt),
        reactionEndsAt: localDeadline(m.reactionMsLeft, m.reactionEndsAt),
        status: store.snap.status === 'opponentAway' ? 'opponentAway' : 'playing',
        roomCode: r.roomId,
      });
      if (m.view.state.phase === 'finished') forgetSeat(r.roomId);
    });
    r.onMessage('rejected', (e: RuleError) => store.set({ error: { error: e, at: Date.now() } }));
    r.onMessage('away', (m: AwayMessage) => {
      if (m.player === store.snap.viewer) return;
      store.set({ status: m.until ? 'opponentAway' : 'playing', awayUntil: m.until });
    });
    // the SDK retries on its own after a drop; the token changes on each reconnection
    r.onDrop(() => store.set({ reconnecting: true }));
    r.onReconnect(() => {
      remember(r);
      store.set({ reconnecting: false });
    });
    r.onLeave(() => {
      if (!disposed && store.snap.state.phase !== 'finished') onFatal('La connexion avec la salle est perdue. Saisis le code pour revenir dans les 90 s.');
    });
  };

  // Joining by code with a saved seat token resumes that seat instead of failing on the locked room.
  let hadSeat = false;
  const join = async (code: string, nickname: string): Promise<Room> => {
    const token = seatToken(code);
    if (token) {
      try {
        return await client.reconnect(token);
      } catch {
        hadSeat = true;
        forgetSeat(code);
      }
    }
    return client.joinById(code, { nickname });
  };

  const p: Promise<Room> =
    'reconnect' in start
      ? ((hadSeat = true), client.reconnect(start.reconnect))
      : start.create
        ? client.create(ROOM_NAME, { mode: start.mode, nickname: start.nickname })
        : join(start.code.toUpperCase(), start.nickname);
  p.then((r) => {
    if (disposed) void r.leave(true);
    else wire(r);
  }).catch((err: unknown) => {
    if ('reconnect' in start) forgetSeat(codeOfToken(start.reconnect));
    onFatal(joinErrorMessage(err, hadSeat));
  });

  return {
    kind: 'online',
    catalog,
    get: store.get,
    subscribe: store.subscribe,
    send(action: Action) {
      if (action.type === 'concede' && room) forgetSeat(room.roomId);
      room?.send('action', action);
    },
    /** "Quitter": a voluntary disconnect; the server keeps the seat for 90 s (only `concede` forfeits). */
    dispose() {
      disposed = true;
      if (room) {
        // a waiting room has no reserved seat to come back to
        if (store.snap.status === 'waiting' || store.snap.status === 'connecting') forgetSeat(room.roomId);
        void room.leave(true);
      }
    },
  };
}
