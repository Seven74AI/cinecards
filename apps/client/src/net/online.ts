import { Client, type Room } from '@colyseus/sdk';
import { createGame, type Action, type Catalog, type DeckMode } from '@cinecards/engine';
import { ROOM_NAME, type AwayMessage, type LobbyMessage, type RuleError, type ViewMessage } from '@cinecards/protocol';
import { appendLog, Store, type Session } from '../game/session.ts';

import { saveToken, SERVER_URL } from './config.ts';

export type OnlineStart = { create: true; mode: DeckMode; nickname: string } | { create: false; code: string; nickname: string } | { reconnect: string };

const FRIENDLY: Record<string, string> = {
  default: 'Connexion au serveur impossible. Vérifie le code ou réessaie plus tard.',
};

/** Online duel through the Colyseus server (stories 6.1–6.6). The engine runs on the server; we only render views. */
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

  const wire = (r: Room) => {
    room = r;
    saveToken(r.reconnectionToken);
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
        turnEndsAt: m.turnEndsAt,
        reactionEndsAt: m.reactionEndsAt,
        status: store.snap.status === 'opponentAway' ? 'opponentAway' : 'playing',
        roomCode: r.roomId,
      });
      if (m.view.state.phase === 'finished') saveToken(null);
    });
    r.onMessage('rejected', (e: RuleError) => store.set({ error: { error: e, at: Date.now() } }));
    r.onMessage('away', (m: AwayMessage) => {
      if (m.player === store.snap.viewer) return;
      store.set({ status: m.until ? 'opponentAway' : 'playing', awayUntil: m.until });
    });
    r.onLeave(() => {
      if (!disposed && store.snap.state.phase !== 'finished') onFatal('La connexion avec la salle est perdue.');
      saveToken(null);
    });
  };

  const opts = { mode: 'create' in start && start.create ? start.mode : undefined, nickname: 'nickname' in start ? start.nickname : undefined };
  const p =
    'reconnect' in start ? client.reconnect(start.reconnect) : start.create ? client.create(ROOM_NAME, opts) : client.joinById(start.code, { nickname: start.nickname });
  p.then((r) => {
    if (disposed) void r.leave(true);
    else wire(r);
  }).catch((err: unknown) => {
    saveToken(null);
    const msg = String((err as Error)?.message ?? err);
    onFatal(/locked|full|not found|no rooms/i.test(msg) ? 'Cette salle n’existe pas ou est déjà complète.' : FRIENDLY.default!);
  });

  return {
    kind: 'online',
    catalog,
    get: store.get,
    subscribe: store.subscribe,
    send(action: Action) {
      room?.send('action', action);
    },
    dispose() {
      disposed = true;
      if (room) void room.leave(true);
      saveToken(null);
    },
  };
}
