/** The account session on this device (story 8.1): token in localStorage, checked against `/api/me` once per visit. */
import { useEffect, useSyncExternalStore } from 'react';
import { logout, me, serverFeatures, type Account } from './api.ts';
import { webAuthnSupported } from './passkeys.ts';

const KEY = 'cinecards.account';

export type SignedIn = Account & { token: string };
/** `unknown` while a stored session is being checked. */
export type AccountState = 'unknown' | 'guest' | SignedIn;

export function readStored(): SignedIn | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SignedIn> | null;
    return v && typeof v.token === 'string' && typeof v.nickname === 'string' && typeof v.id === 'number' ? { token: v.token, nickname: v.nickname, id: v.id } : null;
  } catch {
    return null;
  }
}
export function writeStored(s: SignedIn | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify({ token: s.token, nickname: s.nickname, id: s.id }));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

interface Snapshot {
  account: AccountState;
  /** null while `/api/health` has not answered; false = old server or none: account UI hidden. */
  available: boolean | null;
  /** Story 8.2: the server has passkeys and this browser can use them (otherwise every passkey button is hidden). */
  passkeys: boolean;
  /** Story 8.2: the server has "Mon compte" (`GET /api/account`); a story-8.1 server does not. */
  manage: boolean;
  /** Story 8.3: the server has friends and invitations (`friends: true` in `/api/health`). */
  friends: boolean;
  /** Story 8.4: the server keeps the game history (`history: true` in `/api/health`). */
  history: boolean;
  /** Story 10.2: the server keeps decks (`decks: true` in `/api/health`). */
  decks: boolean;
  /** Story 10.3: the server plays saved decks in rooms (`constructed: true` in `/api/health`). */
  constructed: boolean;
}

let snap: Snapshot = { account: 'unknown', available: null, passkeys: false, manage: false, friends: false, history: false, decks: false, constructed: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<Snapshot>) => {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let started = false;
/** Checks the server, then the stored session: 401 forgets it, a network error keeps what we knew. */
export function initAccount() {
  if (started) return;
  started = true;
  const stored = readStored();
  if (!stored) set({ account: 'guest' });
  void serverFeatures().then(async ({ accounts: available, passkeys, friends, history, decks, constructed }) => {
    set({ available, passkeys: passkeys && webAuthnSupported(), manage: passkeys, friends, history, decks, constructed });
    if (!stored) return;
    if (!available) return set({ account: stored });
    const r = await me(stored.token);
    if (readStored()?.token !== stored.token) return; // signed in or out meanwhile
    if (r.ok) {
      const fresh = { ...stored, ...r.data.account };
      writeStored(fresh);
      set({ account: fresh });
    } else if (r.status === 401) {
      writeStored(null);
      set({ account: 'guest' });
    } else set({ account: stored });
  });
}

export function signIn(token: string, account: Account) {
  const s = { token, ...account };
  writeStored(s);
  set({ account: s });
}

/** "Se déconnecter": forgets the token here and closes it on the server (best effort). */
export function signOut() {
  const s = readStored();
  writeStored(null);
  set({ account: 'guest' });
  if (s) void logout(s.token);
}

export function useAccount() {
  useEffect(initAccount, []);
  const s = useSyncExternalStore(subscribe, () => snap);
  const signedIn = s.available && typeof s.account === 'object' ? s.account : null;
  return { ...s, signedIn };
}
