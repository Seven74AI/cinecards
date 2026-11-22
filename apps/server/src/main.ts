import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { loadSetsFromDir } from '@cinecards/cards/node';
import { playableCardIds } from '@cinecards/engine';
import { ROOM_NAME } from '@cinecards/protocol';
import { DuelRoom, roomConfig } from './room.ts';

export async function startServer(port: number, contentDir = process.env.CONTENT_DIR ?? fileURLToPath(new URL('../../../content/sets', import.meta.url))) {
  const { catalog } = loadSetsFromDir(contentDir);
  roomConfig.catalog = catalog;
  const httpServer = http.createServer();
  // answer the health check before Colyseus' own HTTP routes see the request
  const emit = httpServer.emit.bind(httpServer) as (event: string, ...args: unknown[]) => boolean;
  httpServer.emit = ((event: string, ...args: unknown[]) => {
    const [req, res] = args as [http.IncomingMessage, http.ServerResponse];
    if (event === 'request' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return true;
    }
    return emit(event, ...args);
  }) as typeof httpServer.emit;
  const server = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  server.define(ROOM_NAME, DuelRoom);
  await server.listen(port);
  console.log(`CineCards server on :${port} — ${playableCardIds(catalog).length} cards`);
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startServer(Number(process.env.PORT ?? 2567));
}
