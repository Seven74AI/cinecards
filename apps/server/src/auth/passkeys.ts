import { randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { ensureWebauthnUserId, findAccountById, findAccountByKey, insertAccount } from '../db/accounts.ts';
import { countPasskeys, deletePasskey, findPasskey, insertPasskey, listPasskeys, touchPasskey } from '../db/passkeys.ts';
import { nicknameKey, normalizeNickname, validNickname } from './nickname.ts';
import { MESSAGES, type Account, type AccountService, type AuthError, type AuthResult } from './service.ts';
import { hashRecoveryCode, newRecoveryCode } from './tokens.ts';

/** The relying party of a ceremony: the client page's hostname and origin, never what the client says it is. */
export interface RelyingParty {
  rpID: string;
  origin: string;
}

/** Player-facing messages of the passkey routes (French). */
export const PASSKEY_MESSAGES = {
  origin_not_allowed: 'Ce site ne peut pas utiliser les clés d’accès de CineCards.',
  ceremony_expired: 'La demande a expiré. Réessaie.',
  passkey_failed: 'La clé d’accès n’a pas pu être vérifiée.',
  unknown_passkey: 'Cette clé d’accès n’est plus liée à un compte.',
  last_login_method: 'C’est ta seule façon de te connecter : ajoute d’abord une autre clé ou un mot de passe.',
  passkey_not_found: 'Cette clé d’accès n’existe plus.',
} as const;

const fail = (status: number, error: string, message: string): AuthError => ({ ok: false, status, error, message });

/** A pending ceremony lives 5 minutes; the browser prompt gets the same timeout. */
export const CEREMONY_TTL_MS = 5 * 60 * 1000;
const MAX_CEREMONIES = 1000;

type Ceremony = RelyingParty & { challenge: string; expires: number } & (
    | { kind: 'login' }
    | { kind: 'register'; userId: string; nickname: string; accountId: null }
    | { kind: 'register'; userId: string; nickname: string; accountId: number }
  );

/**
 * Pending challenges, in memory: one-shot (taken out whether the check succeeds or not), 5 min, at most 1,000 (the
 * oldest are dropped). A server restart only cancels the ceremonies in progress.
 */
export class Ceremonies {
  private map = new Map<string, Ceremony>();
  private readonly now: () => number;
  constructor(now: () => number) {
    this.now = now;
  }

  put(c: Ceremony): string {
    this.purge();
    while (this.map.size >= MAX_CEREMONIES) this.map.delete(this.map.keys().next().value!);
    const id = randomBytes(18).toString('base64url');
    this.map.set(id, c);
    return id;
  }

  take(id: unknown): Ceremony | null {
    if (typeof id !== 'string') return null;
    const c = this.map.get(id);
    this.map.delete(id);
    return c && c.expires > this.now() ? c : null;
  }

  purge() {
    const now = this.now();
    for (const [id, c] of this.map) if (c.expires <= now) this.map.delete(id);
  }

  get size() {
    return this.map.size;
  }
}

/** The passkey name, from the device in the User-Agent (no typing). iPadOS that says "Macintosh" shows as Mac. */
export function deviceName(userAgent: string | undefined): string {
  const ua = userAgent ?? '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux|X11|CrOS/.test(ua)) return 'Linux';
  return 'Appareil';
}

const parseTransports = (s: string | null): string[] | undefined => {
  try {
    const v: unknown = s ? JSON.parse(s) : undefined;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : undefined;
  } catch {
    return undefined;
  }
};

const isResponse = (r: unknown): r is { id: string } => !!r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string' && (r as { id: string }).id.length <= 1024;

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/**
 * Passkeys (story 8.2): discoverable WebAuthn credentials, to create an account, sign in without a nickname, and add
 * or remove keys. Shares the account service's database, clock and sessions.
 */
export class PasskeyService {
  private readonly accounts: AccountService;
  readonly ceremonies: Ceremonies;

  constructor(accounts: AccountService) {
    this.accounts = accounts;
    this.ceremonies = new Ceremonies(accounts.now);
  }

  private get db() {
    return this.accounts.db;
  }

  /**
   * Registration options. With a session token: a new key for that account. Without: a new account with this
   * nickname, which is only checked here (it is reserved once the key is verified).
   */
  async registerOptions(
    rp: RelyingParty,
    token: string | null,
    nickname: unknown,
  ): Promise<AuthResult<{ ceremony: string; options: PublicKeyCredentialCreationOptionsJSON }>> {
    let nick: string;
    let userId: string;
    let accountId: number | null = null;
    const exclude: { id: string; transports?: string[] }[] = [];
    if (token) {
      const row = this.accounts.rowOf(token);
      if (!row) return fail(401, 'unauthorized', MESSAGES.unauthorized);
      nick = row.nickname;
      accountId = row.id;
      userId = row.webauthn_user_id ?? ensureWebauthnUserId(this.db, row.id, randomBytes(16).toString('base64url'));
      for (const p of listPasskeys(this.db, row.id)) if (p.rp_id === rp.rpID) exclude.push({ id: p.id, transports: parseTransports(p.transports) });
    } else {
      nick = typeof nickname === 'string' ? normalizeNickname(nickname) : '';
      if (!validNickname(nick)) return fail(400, 'invalid_nickname', MESSAGES.invalid_nickname);
      if (findAccountByKey(this.db, nicknameKey(nick))) return fail(409, 'nickname_taken', MESSAGES.nickname_taken);
      userId = randomBytes(16).toString('base64url');
    }
    const options = await generateRegistrationOptions({
      rpName: 'CineCards',
      rpID: rp.rpID,
      userName: nick,
      userDisplayName: nick,
      userID: new Uint8Array(Buffer.from(userId, 'base64url')),
      timeout: CEREMONY_TTL_MS,
      attestationType: 'none',
      excludeCredentials: exclude,
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    const expires = this.accounts.now() + CEREMONY_TTL_MS;
    const base = { ...rp, challenge: options.challenge, expires, kind: 'register' as const, userId, nickname: nick };
    const ceremony = this.ceremonies.put(accountId === null ? { ...base, accountId: null } : { ...base, accountId });
    return { ok: true, ceremony, options };
  }

  /** Checks the new key; creates the account (with its recovery code) or adds the key to the signed-in account. */
  async registerVerify(
    rp: RelyingParty,
    token: string | null,
    ceremonyId: unknown,
    response: unknown,
    userAgent: string | undefined,
  ): Promise<AuthResult<{ token: string; account: Account; recoveryCode: string } | { passkey: PasskeyInfo }>> {
    const c = this.ceremonies.take(ceremonyId);
    if (!c || c.kind !== 'register' || c.origin !== rp.origin || c.rpID !== rp.rpID) return fail(400, 'ceremony_expired', PASSKEY_MESSAGES.ceremony_expired);
    if (c.accountId !== null && this.accounts.rowOf(token)?.id !== c.accountId) return fail(401, 'unauthorized', MESSAGES.unauthorized);
    if (!isResponse(response)) return fail(400, 'passkey_failed', PASSKEY_MESSAGES.passkey_failed);
    let credential;
    try {
      const v = await verifyRegistrationResponse({
        response: response as unknown as RegistrationResponseJSON,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: c.rpID,
        requireUserVerification: false,
      });
      if (!v.verified) return fail(400, 'passkey_failed', PASSKEY_MESSAGES.passkey_failed);
      credential = v.registrationInfo.credential;
    } catch {
      return fail(400, 'passkey_failed', PASSKEY_MESSAGES.passkey_failed);
    }
    if (findPasskey(this.db, credential.id)) return fail(409, 'passkey_failed', PASSKEY_MESSAGES.passkey_failed);
    const now = this.accounts.now();
    const key = {
      id: credential.id,
      public_key: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ? JSON.stringify(credential.transports) : null,
      rp_id: c.rpID,
      name: deviceName(userAgent),
      created_at: now,
    };
    const info: PasskeyInfo = { id: key.id, name: key.name, createdAt: now, lastUsedAt: null };
    if (c.accountId !== null) {
      insertPasskey(this.db, { ...key, account_id: c.accountId });
      return { ok: true, passkey: info };
    }
    // a new account and its key, together or not at all; the nickname may have been taken meanwhile
    const recoveryCode = newRecoveryCode();
    let id: number | null = null;
    this.db.exec('BEGIN');
    try {
      id = insertAccount(this.db, { nickname: c.nickname, key: nicknameKey(c.nickname), passwordHash: null, recoveryHash: hashRecoveryCode(recoveryCode), now });
      if (id !== null) {
        ensureWebauthnUserId(this.db, id, c.userId);
        insertPasskey(this.db, { ...key, account_id: id });
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    if (id === null) return fail(409, 'nickname_taken', MESSAGES.nickname_taken);
    return { ok: true, token: this.accounts.openSession(id), account: { id, nickname: c.nickname }, recoveryCode };
  }

  /** Sign-in options: no nickname, the device offers its discoverable keys for this site. */
  async loginOptions(rp: RelyingParty): Promise<AuthResult<{ ceremony: string; options: PublicKeyCredentialRequestOptionsJSON }>> {
    const options = await generateAuthenticationOptions({ rpID: rp.rpID, allowCredentials: [], userVerification: 'preferred', timeout: CEREMONY_TTL_MS });
    const ceremony = this.ceremonies.put({ ...rp, kind: 'login', challenge: options.challenge, expires: this.accounts.now() + CEREMONY_TTL_MS });
    return { ok: true, ceremony, options };
  }

  async loginVerify(rp: RelyingParty, ceremonyId: unknown, response: unknown): Promise<AuthResult<{ token: string; account: Account }>> {
    const c = this.ceremonies.take(ceremonyId);
    if (!c || c.kind !== 'login' || c.origin !== rp.origin || c.rpID !== rp.rpID) return fail(400, 'ceremony_expired', PASSKEY_MESSAGES.ceremony_expired);
    if (!isResponse(response)) return fail(400, 'passkey_failed', PASSKEY_MESSAGES.passkey_failed);
    const key = findPasskey(this.db, response.id);
    // a key made for another site is not linked to an account here either
    if (!key || key.rp_id !== c.rpID) return fail(401, 'unknown_passkey', PASSKEY_MESSAGES.unknown_passkey);
    const row = findAccountById(this.db, key.account_id);
    if (!row) return fail(401, 'unknown_passkey', PASSKEY_MESSAGES.unknown_passkey);
    let newCounter: number;
    try {
      const v = await verifyAuthenticationResponse({
        response: response as unknown as AuthenticationResponseJSON,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: c.rpID,
        credential: { id: key.id, publicKey: new Uint8Array(key.public_key), counter: key.counter, transports: parseTransports(key.transports) },
        requireUserVerification: false,
      });
      if (!v.verified) return fail(401, 'passkey_failed', PASSKEY_MESSAGES.passkey_failed);
      // synced keys always report 0: the library only rejects a counter that goes backwards from a non-zero one
      newCounter = v.authenticationInfo.newCounter;
    } catch {
      return fail(401, 'passkey_failed', PASSKEY_MESSAGES.passkey_failed);
    }
    touchPasskey(this.db, key.id, newCounter, this.accounts.now());
    return { ok: true, token: this.accounts.openSession(row.id), account: { id: row.id, nickname: row.nickname } };
  }

  /** "Mon compte": the account, whether it has a password, and its keys. */
  details(token: unknown): AuthResult<{ account: Account; hasPassword: boolean; passkeys: PasskeyInfo[] }> {
    const row = this.accounts.rowOf(token);
    if (!row) return fail(401, 'unauthorized', MESSAGES.unauthorized);
    const passkeys = listPasskeys(this.db, row.id).map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at, lastUsedAt: p.last_used_at }));
    return { ok: true, account: { id: row.id, nickname: row.nickname }, hasPassword: !!row.password_hash, passkeys };
  }

  /** Removes one of the account's keys, unless it is the last way to sign in (no password, last key). */
  remove(token: unknown, id: string): AuthResult<object> {
    const row = this.accounts.rowOf(token);
    if (!row) return fail(401, 'unauthorized', MESSAGES.unauthorized);
    const key = findPasskey(this.db, id);
    if (!key || key.account_id !== row.id) return fail(404, 'passkey_not_found', PASSKEY_MESSAGES.passkey_not_found);
    if (!row.password_hash && countPasskeys(this.db, row.id) <= 1) return fail(409, 'last_login_method', PASSKEY_MESSAGES.last_login_method);
    deletePasskey(this.db, id, row.id);
    return { ok: true };
  }
}
