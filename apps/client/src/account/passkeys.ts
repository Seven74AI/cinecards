/**
 * Passkeys in the browser (story 8.2). `@simplewebauthn/browser` is loaded on the first press only, so the home
 * screen does not carry it.
 */
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { loginOptions, loginVerify, registerOptions, registerVerify, type Account, type ApiResult, type PasskeyInfo } from './api.ts';

/**
 * Same test as the library's `browserSupportsWebAuthn()`, without loading it: the home screen decides whether to show
 * the passkey buttons before anyone presses one.
 */
export const webAuthnSupported = () => typeof globalThis.PublicKeyCredential === 'function';

const load = () => import('@simplewebauthn/browser').catch(() => null);

/** Cancelled or timed out on the device: a quiet note, not a red error (AC 6). */
export const CANCELLED = 'cancelled';
function outcome(error: string, message: string): ApiResult<never> {
  return { ok: false, status: 0, error, message };
}
const notLoaded = () => outcome('network', 'Connexion perdue. Réessaie.');

/** What the device's refusal means for the player. */
export function deviceError(err: unknown, creating: boolean): ApiResult<never> {
  const e = err as { name?: string; code?: string; cause?: { name?: string } } | null;
  const names = [e?.name, e?.cause?.name];
  if (e?.code === 'ERROR_CEREMONY_ABORTED' || names.includes('NotAllowedError') || names.includes('AbortError')) return outcome(CANCELLED, 'Demande annulée.');
  if (e?.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || names.includes('InvalidStateError'))
    return outcome('already_registered', 'Cet appareil a déjà une clé d’accès pour ce compte.');
  return outcome('device_error', creating ? 'Ton appareil n’a pas pu créer la clé d’accès.' : 'Ton appareil n’a pas pu utiliser la clé d’accès.');
}

type Signed = { token: string; account: Account };

/** Creates a key: for a new account with `nickname`, or for the signed-in account with `token`. */
async function register<R>(nickname: string | null, token: string | null): Promise<ApiResult<R>> {
  const [lib, opts] = await Promise.all([load(), registerOptions<PublicKeyCredentialCreationOptionsJSON>(nickname, token)]);
  if (!opts.ok) return opts;
  if (!lib) return notLoaded();
  let response;
  try {
    response = await lib.startRegistration({ optionsJSON: opts.data.options });
  } catch (err) {
    return deviceError(err, true);
  }
  return registerVerify<R>(opts.data.ceremony, response, token);
}

/** A new account with only a passkey; the nickname is reserved once the key is verified. */
export const createWithPasskey = (nickname: string) => register<Signed & { recoveryCode: string }>(nickname, null);

/** Another key for the signed-in account. */
export const addPasskey = (token: string) => register<{ passkey: PasskeyInfo }>(null, token);

/** Signs in without a nickname: the device offers its keys for this site. */
export async function loginWithPasskey(): Promise<ApiResult<Signed>> {
  const [lib, opts] = await Promise.all([load(), loginOptions<PublicKeyCredentialRequestOptionsJSON>()]);
  if (!opts.ok) return opts;
  if (!lib) return notLoaded();
  let response;
  try {
    response = await lib.startAuthentication({ optionsJSON: opts.data.options });
  } catch (err) {
    return deviceError(err, false);
  }
  return loginVerify(opts.data.ceremony, response);
}
