import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { playableCardIds } from '@cinecards/engine';
import { HUB_ROOM_NAME, ROOM_NAME } from '@cinecards/protocol';
import { createApi, parseOrigins } from './api/http.ts';
import { AccountService } from './auth/service.ts';
import { startMaintenance } from './db/backup.ts';
import { dbPath, openDb } from './db/db.ts';
import { HistoryService } from './history.ts';
import { HubRoom, hubConfig } from './hub.ts';
import { DuelRoom, findDuelRoom, roomConfig } from './room.ts';
import { Social } from './social/social.ts';
import { createStatic } from './static.ts';

export interface ServerOptions {
  /** Folder of the SQLite file and its daily copies; ':memory:' keeps nothing (tests). Default: DATA_DIR or ./data. */
  dataDir?: string;
  /** Allowed browser origins for `/api/*` (localhost is always allowed). Default: CLIENT_ORIGINS or DEFAULT_CLIENT_ORIGINS. */
  clientOrigins?: string[];
  now?: () => number;
  /** Folder of the built client (story 8.6), served at `/`; unset = no game files (dev, tests). Default: CLIENT_DIR. */
  clientDir?: string;
  /** Invitation lifetime (story 8.3), read at each invitation; default 2 min. */
  inviteTtlMs?: () => number;
}

export async function startServer(
  port: number,
  contentDir = process.env.CONTENT_DIR ?? fileURLToPath(new URL('../../../content/sets', import.meta.url)),
  opts: ServerOptions = {},
) {
  const { catalog } = loadSetsFromDir(contentDir);
  roomConfig.catalog = catalog;
  const dataDir = opts.dataDir ?? process.env.DATA_DIR ?? './data';
  const db = openDb(dbPath(dataDir));
  const accounts = new AccountService(db, opts.now);
  roomConfig.accounts = accounts;
  // story 8.3: friends, presence and invitations, shared by the hub and the duel rooms
  const social = new Social(db, (t) => accounts.accountOf(t), { now: opts.now, findRoom: findDuelRoom, inviteTtlMs: opts.inviteTtlMs });
  roomConfig.presence = social.presence;
  roomConfig.invites = social.invites;
  hubConfig.social = social;
  // story 8.4: the duel rooms record finished games; the API reads them
  const history = new HistoryService(db, (t) => accounts.accountOf(t));
  roomConfig.history = history;
  const stopMaintenance = startMaintenance(db, dataDir, accounts.purge);
  const api = createApi(accounts, opts.clientOrigins ?? parseOrigins(process.env.CLIENT_ORIGINS), undefined, social.friends, history);
  const files = createStatic(opts.clientDir ?? process.env.CLIENT_DIR);
  const httpServer = http.createServer();
  // answer the health check, the JSON API and the game's files (GET/HEAD only) before Colyseus' own HTTP routes see the request
  const emit = httpServer.emit.bind(httpServer) as (event: string, ...args: unknown[]) => boolean;
  httpServer.emit = ((event: string, ...args: unknown[]) => {
    if (event === 'request') {
      const [req, res] = args as [http.IncomingMessage, http.ServerResponse];
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
        return true;
      }
      if (api(req, res)) return true;
      if (files(req, res)) return true;
    }
    return emit(event, ...args);
  }) as typeof httpServer.emit;
  const server = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  server.define(ROOM_NAME, DuelRoom);
  server.define(HUB_ROOM_NAME, HubRoom);
  server.onShutdown(() => {
    stopMaintenance();
    if (roomConfig.accounts === accounts) roomConfig.accounts = null;
    if (roomConfig.history === history) roomConfig.history = null;
    if (hubConfig.social === social) {
      hubConfig.social = null;
      roomConfig.presence = null;
      roomConfig.invites = null;
    }
    social.dispose();
    db.close();
  });
  await server.listen(port);
  console.log(`CineCards server on :${port} — ${playableCardIds(catalog).length} cards — data in ${dataDir}`);
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startServer(Number(process.env.PORT ?? 2567));
}
