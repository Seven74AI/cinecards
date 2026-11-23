import type http from 'node:http';
import { PASSKEY_MESSAGES, PasskeyService, type RelyingParty } from '../auth/passkeys.ts';
import type { AccountService, AuthResult } from '../auth/service.ts';
import type { HistoryService } from '../history.ts';
import type { FriendService } from '../social/friends.ts';

/**
 * Default client origins: the game on Root's domain (story 8.6) and the old GitHub Pages site during the move;
 * override with CLIENT_ORIGINS (comma-separated).
 */
export const DEFAULT_CLIENT_ORIGINS = ['https://cinecards.sevend.io', 'https://seven74ai.github.io'];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
const MAX_BODY = 8 * 1024;

export const parseOrigins = (env: string | undefined) =>
  env
    ? env
        .split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : DEFAULT_CLIENT_ORIGINS;

export const originAllowed = (origin: string | undefined, allowed: string[]) => !!origin && (allowed.includes(origin) || LOCAL_ORIGIN.test(origin));

/**
 * The WebAuthn relying party of a request (story 8.2), from its `Origin` header and only for an allowed origin:
 * rpID = the origin's hostname, expected origin = the origin itself. Null when the origin is missing or refused.
 */
export function relyingParty(origin: string | undefined, allowed: string[]): RelyingParty | null {
  if (!originAllowed(origin, allowed)) return null;
  try {
    const url = new URL(origin!);
    return { rpID: url.hostname, origin: url.origin };
  } catch {
    return null;
  }
}

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const readJson = (req: http.IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    req.on('data', (c: Buffer) => {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY) {
        done = true;
        reject(new HttpError(413, 'too_large', 'Requête trop grosse.'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
        resolve(body as Record<string, unknown>);
      } catch {
        reject(new HttpError(400, 'bad_json', 'Requête illisible.'));
      }
    });
    req.on('error', reject);
  });

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const bearer = (req: http.IncomingMessage) => /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1] ?? null;

/**
 * JSON API under `/api/` (story 8.1), served on the game server's port. Returns a request handler that
 * answers `/api/*` and returns true, or returns false so the request goes on to Colyseus.
 */
export function createApi(service: AccountService, origins: string[], passkeys = new PasskeyService(service), friends?: FriendService, history?: HistoryService) {
  return (req: http.IncomingMessage, res: http.ServerResponse): boolean => {
    const path = (req.url ?? '').split('?')[0]!;
    if (path !== '/api' && !path.startsWith('/api/')) return false;
    const origin = req.headers.origin;
    const cors: Record<string, string> = { Vary: 'Origin' };
    if (originAllowed(origin, origins)) cors['Access-Control-Allow-Origin'] = origin!;
    const send = (status: number, body?: unknown) => {
      if (res.headersSent) return;
      if (body === undefined) res.writeHead(status, cors).end();
      else res.writeHead(status, { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
    };
    const reply = <T>(r: AuthResult<T>, okStatus: number) => {
      if (r.ok) {
        const { ok: _ok, ...data } = r;
        send(okStatus, okStatus === 204 ? undefined : data);
      } else send(r.status, { error: r.error, message: r.message, ...(r.retryAfterSeconds ? { retryAfterSeconds: r.retryAfterSeconds } : {}) });
    };
    if (req.method === 'OPTIONS') {
      res
        .writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' })
        .end();
      return true;
    }
    const route = `${req.method} ${path}`;
    const rp = relyingParty(origin, origins);
    const needRp = () => {
      if (!rp) throw new HttpError(403, 'origin_not_allowed', PASSKEY_MESSAGES.origin_not_allowed);
      return rp;
    };
    void (async () => {
      // routes with a parameter (stories 8.2, 8.3)
      const keyId = req.method === 'DELETE' && path.startsWith('/api/passkeys/') ? safeDecode(path.slice('/api/passkeys/'.length)) : null;
      if (keyId) return reply(passkeys.remove(bearer(req), keyId), 204);
      const friend = friends ? /^\/api\/friends\/(\d{1,15})(\/accept)?$/.exec(path) : null;
      if (friend && req.method === 'POST' && friend[2]) {
        req.resume(); // no body expected
        return reply(friends!.accept(bearer(req), Number(friend[1])), 204);
      }
      if (friend && req.method === 'DELETE' && !friend[2]) return reply(friends!.remove(bearer(req), Number(friend[1])), 204);
      switch (route) {
        case 'GET /api/health':
          return send(200, { ok: true, accounts: true, passkeys: true, ...(friends ? { friends: true } : {}), ...(history ? { history: true } : {}) });
        case 'GET /api/history':
          if (!history) break;
          return reply(history.list(bearer(req)), 200);
        case 'GET /api/friends':
          if (!friends) break;
          return reply(friends.list(bearer(req)), 200);
        case 'POST /api/friends': {
          if (!friends) break;
          const b = await readJson(req);
          return reply(friends.request(bearer(req), b.nickname), 201);
        }
        case 'POST /api/accounts': {
          const b = await readJson(req);
          return reply(await service.create(b.nickname, b.password), 201);
        }
        case 'POST /api/sessions': {
          const b = await readJson(req);
          return reply(await service.login(b.nickname, b.password), 200);
        }
        case 'GET /api/me': {
          const account = service.accountOf(bearer(req));
          return account ? send(200, { account }) : send(401, { error: 'unauthorized', message: 'Ta session a expiré. Reconnecte-toi.' });
        }
        case 'DELETE /api/sessions/current':
          service.logout(bearer(req));
          return send(204);
        case 'POST /api/recover': {
          const b = await readJson(req);
          return reply(await service.recover(b.nickname, b.recoveryCode, b.newPassword), 200);
        }
        case 'POST /api/passkeys/register/options': {
          const r = needRp();
          const b = await readJson(req);
          return reply(await passkeys.registerOptions(r, bearer(req), b.nickname), 200);
        }
        case 'POST /api/passkeys/register/verify': {
          const r = needRp();
          const b = await readJson(req);
          return reply(await passkeys.registerVerify(r, bearer(req), b.ceremony, b.response, req.headers['user-agent']), 201);
        }
        case 'POST /api/passkeys/login/options':
          req.resume(); // no body expected
          return reply(await passkeys.loginOptions(needRp()), 200);
        case 'POST /api/passkeys/login/verify': {
          const r = needRp();
          const b = await readJson(req);
          return reply(await passkeys.loginVerify(r, b.ceremony, b.response), 200);
        }
        case 'GET /api/account':
          return reply(passkeys.details(bearer(req)), 200);
        case 'POST /api/password': {
          const b = await readJson(req);
          return reply(await service.changePassword(bearer(req), b.currentPassword, b.newPassword), 204);
        }
      }
      return send(404, { error: 'not_found', message: 'Introuvable.' });
    })().catch((err: unknown) => {
      if (err instanceof HttpError) {
        send(err.status, { error: err.code, message: err.message });
        if (err.status === 413) req.resume();
        return;
      }
      console.error('api error', route, err);
      send(500, { error: 'server_error', message: 'Erreur du serveur. Réessaie plus tard.' });
    });
    return true;
  };
}
