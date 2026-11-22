import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { playableCardIds } from '@cinecards/engine';
import { ROOM_NAME } from '@cinecards/protocol';
import { createApi, parseOrigins } from './api/http.ts';
import { AccountService } from './auth/service.ts';
import { startMaintenance } from './db/backup.ts';
import { dbPath, openDb } from './db/db.ts';
import { DuelRoom, roomConfig } from './room.ts';

export interface ServerOptions {
  /** Folder of the SQLite file and its daily copies; ':memory:' keeps nothing (tests). Default: DATA_DIR or ./data. */
  dataDir?: string;
  /** Allowed browser origins for `/api/*` (localhost is always allowed). Default: CLIENT_ORIGINS or GitHub Pages. */
  clientOrigins?: string[];
  now?: () => number;
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
  const stopMaintenance = startMaintenance(db, dataDir, accounts.purge);
  const api = createApi(accounts, opts.clientOrigins ?? parseOrigins(process.env.CLIENT_ORIGINS));
  const httpServer = http.createServer();
  // answer the health check and the JSON API before Colyseus' own HTTP routes see the request
  const emit = httpServer.emit.bind(httpServer) as (event: string, ...args: unknown[]) => boolean;
  httpServer.emit = ((event: string, ...args: unknown[]) => {
    if (event === 'request') {
      const [req, res] = args as [http.IncomingMessage, http.ServerResponse];
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
        return true;
      }
      if (api(req, res)) return true;
    }
    return emit(event, ...args);
  }) as typeof httpServer.emit;
  const server = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  server.define(ROOM_NAME, DuelRoom);
  server.onShutdown(() => {
    stopMaintenance();
    if (roomConfig.accounts === accounts) roomConfig.accounts = null;
    db.close();
  });
  await server.listen(port);
  console.log(`CineCards server on :${port} — ${playableCardIds(catalog).length} cards — data in ${dataDir}`);
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startServer(Number(process.env.PORT ?? 2567));
}
