import { afterEach, describe, expect, it } from 'vitest';
import { CANCELLED, deviceError, webAuthnSupported } from './passkeys.ts';

describe('8.2 passkeys in the browser', () => {
  afterEach(() => {
    delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  });

  it('shows passkeys only where WebAuthn exists', () => {
    expect(webAuthnSupported()).toBe(false);
    (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential = function PublicKeyCredential() {};
    expect(webAuthnSupported()).toBe(true);
  });

  it('treats a cancelled or timed-out request as a quiet note', () => {
    for (const err of [{ name: 'NotAllowedError' }, { name: 'AbortError' }, { code: 'ERROR_CEREMONY_ABORTED' }, { name: 'WebAuthnError', cause: { name: 'NotAllowedError' } }]) {
      expect(deviceError(err, true)).toEqual({ ok: false, status: 0, error: CANCELLED, message: 'Demande annulée.' });
    }
  });

  it('explains a key already on this device, and other device errors', () => {
    expect(deviceError({ name: 'InvalidStateError' }, true)).toMatchObject({ error: 'already_registered' });
    expect(deviceError(new Error('boom'), true)).toMatchObject({ error: 'device_error', message: 'Ton appareil n’a pas pu créer la clé d’accès.' });
    expect(deviceError(null, false)).toMatchObject({ error: 'device_error', message: 'Ton appareil n’a pas pu utiliser la clé d’accès.' });
  });
});
