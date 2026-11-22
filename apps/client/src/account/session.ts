/** The account session on this device (story 8.1): token in localStorage, checked against `/api/me` once per visit. */
import { useEffect, useSyncExternalStore } from 'react';
import { accountsAvailable, logout, me, type Account } from './api.ts';

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
}

let snap: Snapshot = { account: 'unknown', available: null };
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
  void accountsAvailable().then(async (available) => {
    set({ available });
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
