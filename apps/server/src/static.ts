import { createReadStream, statSync } from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

/** Content types of the files a Vite build of the client can hold (story 8.6). */
export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

const IMMUTABLE = 'public, max-age=31536000, immutable';
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
/** Paths that belong to the server itself, never to the game's files. */
const RESERVED = /^\/(api|matchmake)(\/|$)|^\/__|^\/health$/;

const isFile = (p: string) => {
  try {
    const s = statSync(p);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
};

/**
 * The built client (story 8.6), served by the game server so the page, `/api` and the WebSocket share one origin.
 * Returns a request handler in the style of `createApi`: true when it answered, false to let the request go on
 * (to Colyseus). Inert (always false) when `clientDir` is unset or has no `index.html`.
 */
export function createStatic(clientDir: string | undefined) {
  const root = clientDir ? path.resolve(clientDir) : '';
  const index = root ? path.join(root, 'index.html') : '';
  if (!root || !isFile(index)) return (_req: http.IncomingMessage, _res: http.ServerResponse) => false;

  const sendFile = (req: http.IncomingMessage, res: http.ServerResponse, file: string, size: number) => {
    const ext = path.extname(file).toLowerCase();
    const rel = path.relative(root, file).split(path.sep);
    const cache = file === index || ext === '.html' ? 'no-cache' : rel[0] === 'assets' ? IMMUTABLE : 'public, max-age=3600';
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream', 'Content-Length': size, 'Cache-Control': cache });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  };
  const notFound = (res: http.ServerResponse) =>
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }).end('Introuvable.');

  return (req: http.IncomingMessage, res: http.ServerResponse): boolean => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (req.headers.upgrade) return false;
    const raw = (req.url ?? '/').split('?')[0]!.split('#')[0]!;
    if (!raw.startsWith('/') || RESERVED.test(raw)) return false;
    let pathname: string;
    try {
      pathname = decodeURIComponent(raw);
    } catch {
      notFound(res);
      return true;
    }
    if (pathname.includes('\0') || RESERVED.test(pathname)) {
      notFound(res);
      return true;
    }
    const target = path.resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) {
      notFound(res);
      return true;
    }
    const stat = target === root ? null : isFile(target);
    if (stat) {
      sendFile(req, res, target, stat.size);
      return true;
    }
    // client-side routes and invitation links (`/?salle=…`, reloads) get the game; a missing file is a 404
    if (path.extname(pathname)) {
      notFound(res);
      return true;
    }
    const indexStat = isFile(index);
    if (!indexStat) {
      notFound(res);
      return true;
    }
    sendFile(req, res, index, indexStat.size);
    return true;
  };
}
