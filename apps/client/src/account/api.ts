/** Accounts API client (story 8.1). Plain `fetch`, no Colyseus SDK: it loads with the home screen. */
import type { FriendsList } from '@cinecards/protocol';
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

export interface ServerFeatures {
  accounts: boolean;
  /** Story 8.2: a story-8.1 server answers without this field, which hides every passkey button. */
  passkeys: boolean;
  /** Story 8.3: friends and invitations; an older server answers without it, which hides "Amis". */
  friends: boolean;
  /** Story 8.4: game history; an older server answers without it, which hides "Historique". */
  history: boolean;
  /** Story 10.2: decks saved on the account; an older server answers without it, which hides "Mes decks". */
  decks: boolean;
  /** Story 10.3: constructed rooms (a story-10.2 server keeps decks but cannot play them yet). */
  constructed: boolean;
}

let features: Promise<ServerFeatures> | null = null;
/** What the server offers (`GET /api/health`, 4 s, once per visit). An older server, or none, hides the account UI. */
export function serverFeatures(): Promise<ServerFeatures> {
  features ??= call<{ accounts?: boolean; passkeys?: boolean; friends?: boolean; history?: boolean; decks?: boolean; constructed?: boolean }>('GET', '/api/health', { timeoutMs: 4000 }).then((r) => ({
    accounts: r.ok && r.data?.accounts === true,
    passkeys: r.ok && r.data?.accounts === true && r.data?.passkeys === true,
    friends: r.ok && r.data?.accounts === true && r.data?.friends === true,
    history: r.ok && r.data?.accounts === true && r.data?.history === true,
    decks: r.ok && r.data?.accounts === true && r.data?.decks === true,
    constructed: r.ok && r.data?.accounts === true && r.data?.decks === true && r.data?.constructed === true,
  }));
  return features;
}

/** True when the server has accounts. */
export const accountsAvailable = () => serverFeatures().then((f) => f.accounts);

type Signed = { token: string; account: Account };
export const createAccount = (nickname: string, password: string) => call<Signed & { recoveryCode: string }>('POST', '/api/accounts', { body: { nickname, password } });
export const login = (nickname: string, password: string) => call<Signed>('POST', '/api/sessions', { body: { nickname, password } });
export const me = (token: string) => call<{ account: Account }>('GET', '/api/me', { token });
export const logout = (token: string) => call<null>('DELETE', '/api/sessions/current', { token });
/** The recovery code; without `newPassword` (story 8.2) it only opens a session, and the client then adds a passkey. */
export const recover = (nickname: string, recoveryCode: string, newPassword?: string) =>
  call<Signed & { recoveryCode: string }>('POST', '/api/recover', { body: newPassword === undefined ? { nickname, recoveryCode } : { nickname, recoveryCode, newPassword } });

// ---- story 8.2: passkeys and "Mon compte" ----
export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
}
export interface AccountDetails {
  account: Account;
  hasPassword: boolean;
  passkeys: PasskeyInfo[];
}
/** Options JSON from the server, handed as is to the WebAuthn library. */
type Options<T> = { ceremony: string; options: T };
export const registerOptions = <T>(nickname: string | null, token: string | null) =>
  call<Options<T>>('POST', '/api/passkeys/register/options', { body: nickname === null ? {} : { nickname }, token });
export const registerVerify = <R>(ceremony: string, response: unknown, token: string | null) =>
  call<R>('POST', '/api/passkeys/register/verify', { body: { ceremony, response }, token });
export const loginOptions = <T>() => call<Options<T>>('POST', '/api/passkeys/login/options');
export const loginVerify = (ceremony: string, response: unknown) => call<Signed>('POST', '/api/passkeys/login/verify', { body: { ceremony, response } });
export const accountDetails = (token: string) => call<AccountDetails>('GET', '/api/account', { token });
export const removePasskey = (token: string, id: string) => call<null>('DELETE', `/api/passkeys/${encodeURIComponent(id)}`, { token });
export const changePassword = (token: string, currentPassword: string | null, newPassword: string) =>
  call<null>('POST', '/api/password', { token, body: currentPassword === null ? { newPassword } : { currentPassword, newPassword } });

/** Shows a typed recovery code in its printed form: capitals, groups of 4 (`ABCD-EFGH-…`). */
export const formatRecoveryCode = (typed: string) =>
  typed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
    .replace(/(.{4})(?=.)/g, '$1-');

// ---- story 8.3: friends ----
export const friendsList = (token: string) => call<FriendsList>('GET', '/api/friends', { token });
export const requestFriend = (token: string, nickname: string) => call<{ status: 'pending' | 'accepted' }>('POST', '/api/friends', { token, body: { nickname } });
export const acceptFriend = (token: string, id: number) => call<null>('POST', `/api/friends/${id}/accept`, { token });
/** Declines a received request, cancels a sent one or removes a friend. */
export const removeFriend = (token: string, id: number) => call<null>('DELETE', `/api/friends/${id}`, { token });

// ---- story 8.4: history ----
/** A game's result from my point of view. */
export type GameResult = 'win' | 'loss' | 'draw' | 'conceded' | 'opponent_conceded';
export interface PlayedGame {
  id: number;
  result: GameResult;
  opponent: { nickname: string; isGuest: boolean };
  mode: string;
  turns: number;
  endedAt: number;
  durationMs: number;
}
export interface HistoryList {
  record: { wins: number; losses: number; draws: number };
  games: PlayedGame[];
}
export const history = (token: string) => call<HistoryList>('GET', '/api/history', { token });
// ---- story 10.2: decks saved on the account (status computed by the server) ----
export interface SavedDeck {
  id: number;
  name: string;
  cards: string[];
  valid: boolean;
  errors: string[];
  updatedAt: number;
}
export const listDecks = (token: string) => call<{ decks: SavedDeck[] }>('GET', '/api/decks', { token });
export const createDeck = (token: string, name: string, cards: string[]) => call<{ deck: SavedDeck }>('POST', '/api/decks', { token, body: { name, cards } });
export const updateDeck = (token: string, id: number, name: string, cards: string[]) => call<{ deck: SavedDeck }>('PUT', `/api/decks/${id}`, { token, body: { name, cards } });
export const deleteDeck = (token: string, id: number) => call<null>('DELETE', `/api/decks/${id}`, { token });
