/** Accounts API client (story 8.1). Plain `fetch`, no Colyseus SDK: it loads with the home screen. */
import { SERVER_URL } from '../net/config.ts';

/** HTTP base of the game server, from its WebSocket URL (`ws://` → `http://`, `wss://` → `https://`). */
export const apiUrl = (serverUrl: string) => serverUrl.replace(/^ws(s?):\/\//i, 'http$1://').replace(/\/+$/, '');

export const API_URL = SERVER_URL ? apiUrl(SERVER_URL) : '';

export interface Account {
  id: number;
  nickname: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; message: string; retryAfterSeconds?: number };

const NETWORK: ApiResult<never> = { ok: false, status: 0, error: 'network', message: 'Serveur injoignable. Réessaie plus tard.' };

async function call<T>(method: string, path: string, opts: { body?: unknown; token?: string | null; timeoutMs?: number } = {}): Promise<ApiResult<T>> {
  if (!API_URL) return NETWORK;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 10_000);
  try {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(API_URL + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctl.signal });
    const data = res.status === 204 ? null : ((await res.json().catch(() => null)) as Record<string, unknown> | null);
    if (res.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      status: res.status,
      error: typeof data?.error === 'string' ? data.error : 'server_error',
      message: typeof data?.message === 'string' ? data.message : 'Erreur du serveur. Réessaie plus tard.',
      ...(typeof data?.retryAfterSeconds === 'number' ? { retryAfterSeconds: data.retryAfterSeconds } : {}),
    };
  } catch {
    return NETWORK;
  } finally {
    clearTimeout(timer);
  }
}

let available: Promise<boolean> | null = null;
/** True when the server has accounts (`GET /api/health`, 4 s, once per visit). An older server, or none, hides the account UI. */
export function accountsAvailable(): Promise<boolean> {
  available ??= call<{ accounts?: boolean }>('GET', '/api/health', { timeoutMs: 4000 }).then((r) => r.ok && r.data?.accounts === true);
  return available;
}

type Signed = { token: string; account: Account };
export const createAccount = (nickname: string, password: string) => call<Signed & { recoveryCode: string }>('POST', '/api/accounts', { body: { nickname, password } });
export const login = (nickname: string, password: string) => call<Signed>('POST', '/api/sessions', { body: { nickname, password } });
export const me = (token: string) => call<{ account: Account }>('GET', '/api/me', { token });
export const logout = (token: string) => call<null>('DELETE', '/api/sessions/current', { token });
export const recover = (nickname: string, recoveryCode: string, newPassword: string) =>
  call<Signed & { recoveryCode: string }>('POST', '/api/recover', { body: { nickname, recoveryCode, newPassword } });

/** Shows a typed recovery code in its printed form: capitals, groups of 4 (`ABCD-EFGH-…`). */
export const formatRecoveryCode = (typed: string) =>
  typed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
    .replace(/(.{4})(?=.)/g, '$1-');
