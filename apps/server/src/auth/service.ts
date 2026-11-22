import type { Db } from '../db/db.ts';
import { findAccountById, findAccountByKey, insertAccount, setPasswordHash, setRecoveryHash } from '../db/accounts.ts';
import { createSession, deleteAccountSessions, deleteOtherSessions, deleteSession, purgeSessions, readSession } from '../db/sessions.ts';
import { Limiter } from './limiter.ts';
import { nicknameKey, normalizeNickname, validNickname, validPassword } from './nickname.ts';
import { dummyVerify, hashPassword, verifyPassword } from './password.ts';
import { hashRecoveryCode, newRecoveryCode, newSessionToken, sameHash, sha256 } from './tokens.ts';

export interface Account {
  id: number;
  nickname: string;
}

export type AuthError = { ok: false; status: number; error: string; message: string; retryAfterSeconds?: number };
export type AuthResult<T> = ({ ok: true } & T) | AuthError;

/** Player-facing messages (French, as at the table). */
export const MESSAGES = {
  invalid_nickname: '3 à 16 caractères : lettres, chiffres, espace, - et _.',
  invalid_password: '8 caractères au moins.',
  nickname_taken: 'Ce pseudo est déjà pris.',
  bad_credentials: 'Pseudo ou mot de passe incorrect.',
  bad_recovery: 'Pseudo ou code de secours incorrect.',
  unauthorized: 'Ta session a expiré. Reconnecte-toi.',
  wrong_current_password: 'Ancien mot de passe incorrect.',
} as const;

const fail = (status: number, error: keyof typeof MESSAGES | string, message: string): AuthError => ({ ok: false, status, error, message });

/**
 * Accounts with nickname + password, sessions and the recovery code (story 8.1).
 * The clock is injected so the 90-day sessions and the 15-min window are tested without waiting.
 */
export class AccountService {
  readonly db: Db;
  readonly now: () => number;
  private limiter: Limiter;

  constructor(db: Db, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
    this.limiter = new Limiter(now);
  }

  /** Opens a session for the account and returns its token (also used by the passkey service, story 8.2). */
  openSession(accountId: number): string {
    const token = newSessionToken();
    createSession(this.db, sha256(token), accountId, this.now());
    return token;
  }

  private tooMany(key: string): AuthError | null {
    const ms = this.limiter.retryAfterMs(key);
    if (!ms) return null;
    const seconds = Math.ceil(ms / 1000);
    return { ok: false, status: 429, error: 'too_many_attempts', message: `Trop d’essais. Réessaie dans ${Math.ceil(seconds / 60)} min.`, retryAfterSeconds: seconds };
  }

  async create(nickname: unknown, password: unknown): Promise<AuthResult<{ token: string; account: Account; recoveryCode: string }>> {
    const nick = typeof nickname === 'string' ? normalizeNickname(nickname) : '';
    if (!validNickname(nick)) return fail(400, 'invalid_nickname', MESSAGES.invalid_nickname);
    if (!validPassword(password)) return fail(400, 'invalid_password', MESSAGES.invalid_password);
    const key = nicknameKey(nick);
    if (findAccountByKey(this.db, key)) return fail(409, 'nickname_taken', MESSAGES.nickname_taken);
    const passwordHash = await hashPassword(password);
    const recoveryCode = newRecoveryCode();
    const id = insertAccount(this.db, { nickname: nick, key, passwordHash, recoveryHash: hashRecoveryCode(recoveryCode), now: this.now() });
    if (id === null) return fail(409, 'nickname_taken', MESSAGES.nickname_taken); // taken while we were hashing
    return { ok: true, token: this.openSession(id), account: { id, nickname: nick }, recoveryCode };
  }

  async login(nickname: unknown, password: unknown): Promise<AuthResult<{ token: string; account: Account }>> {
    const key = typeof nickname === 'string' ? nicknameKey(nickname) : '';
    const limited = this.tooMany(key);
    if (limited) return limited;
    const row = key ? findAccountByKey(this.db, key) : undefined;
    const pw = typeof password === 'string' ? password.slice(0, 1024) : '';
    let ok = false;
    if (row?.password_hash) ok = await verifyPassword(pw, row.password_hash);
    else await dummyVerify(pw);
    if (!row || !ok) {
      this.limiter.fail(key);
      return fail(401, 'bad_credentials', MESSAGES.bad_credentials);
    }
    return { ok: true, token: this.openSession(row.id), account: { id: row.id, nickname: row.nickname } };
  }

  /** The account behind a session token, or null (unknown, expired, or not a string). Synchronous: usable in `onJoin`. */
  accountOf(token: unknown): Account | null {
    if (typeof token !== 'string' || !token || token.length > 200) return null;
    const id = readSession(this.db, sha256(token), this.now());
    if (id === null) return null;
    const row = findAccountById(this.db, id);
    return row ? { id: row.id, nickname: row.nickname } : null;
  }

  logout(token: unknown) {
    if (typeof token === 'string' && token) deleteSession(this.db, sha256(token));
  }

  /**
   * The recovery code: closes every session, opens a new one and issues a new code. With `newPassword` it also sets
   * that password (story 8.1, unchanged for old clients); without it (story 8.2) the client goes on to add a passkey
   * with the new session.
   */
  async recover(nickname: unknown, recoveryCode: unknown, newPassword?: unknown): Promise<AuthResult<{ token: string; account: Account; recoveryCode: string }>> {
    const withPassword = newPassword !== undefined && newPassword !== null;
    if (withPassword && !validPassword(newPassword)) return fail(400, 'invalid_password', MESSAGES.invalid_password);
    const key = typeof nickname === 'string' ? nicknameKey(nickname) : '';
    const limited = this.tooMany(key);
    if (limited) return limited;
    const row = key ? findAccountByKey(this.db, key) : undefined;
    const given = typeof recoveryCode === 'string' ? hashRecoveryCode(recoveryCode.slice(0, 64)) : '';
    if (!row || !sameHash(given, row.recovery_hash)) {
      this.limiter.fail(key);
      return fail(401, 'bad_credentials', MESSAGES.bad_recovery);
    }
    const passwordHash = withPassword ? await hashPassword(newPassword as string) : null;
    const code = newRecoveryCode();
    if (passwordHash) setPasswordHash(this.db, row.id, passwordHash);
    setRecoveryHash(this.db, row.id, hashRecoveryCode(code));
    deleteAccountSessions(this.db, row.id);
    return { ok: true, token: this.openSession(row.id), account: { id: row.id, nickname: row.nickname }, recoveryCode: code };
  }

  /** The signed-in account row behind a token, or null. */
  rowOf(token: unknown) {
    const account = this.accountOf(token);
    return account ? (findAccountById(this.db, account.id) ?? null) : null;
  }

  /**
   * Chooses or changes the password from "Mon compte" (story 8.2). The current password is required when there is one
   * and counts towards the failed-attempt limit; a change closes the account's other sessions.
   */
  async changePassword(token: unknown, currentPassword: unknown, newPassword: unknown): Promise<AuthResult<object>> {
    const row = this.rowOf(token);
    if (!row) return fail(401, 'unauthorized', MESSAGES.unauthorized);
    if (!validPassword(newPassword)) return fail(400, 'invalid_password', MESSAGES.invalid_password);
    if (row.password_hash) {
      const limited = this.tooMany(row.nickname_key);
      if (limited) return limited;
      const pw = typeof currentPassword === 'string' ? currentPassword.slice(0, 1024) : '';
      if (!(await verifyPassword(pw, row.password_hash))) {
        this.limiter.fail(row.nickname_key);
        return fail(403, 'bad_credentials', MESSAGES.wrong_current_password);
      }
    }
    setPasswordHash(this.db, row.id, await hashPassword(newPassword));
    deleteOtherSessions(this.db, row.id, sha256(token as string));
    return { ok: true };
  }

  purge = () => purgeSessions(this.db, this.now());
}
