import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { accountDetails, changePassword, removePasskey, type AccountDetails, type PasskeyInfo } from './api.ts';
import { PasswordField } from './AccountDialog.tsx';
import { addPasskey, CANCELLED } from './passkeys.ts';
import { signOut, useAccount, type SignedIn } from './session.ts';

/** Same text as the server's `last_login_method`, shown before asking (the server refuses it too). */
const LAST_METHOD = 'C’est ta seule façon de te connecter : ajoute d’abord une autre clé ou un mot de passe.';

const day = (ms: number) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** One passkey: device name, dates, and "Retirer" with an inline confirmation. */
function PasskeyItem({ k, onRemove, busy }: { k: PasskeyInfo; onRemove: (k: PasskeyInfo, confirmed: boolean) => boolean; busy: boolean }) {
  const [asking, setAsking] = useState(false);
  return (
    <li className="passkey-item">
      <div className="passkey-text">
        <strong>{k.name}</strong>
        <small className="muted">
          Ajoutée le {day(k.createdAt)} · {k.lastUsedAt ? `utilisée le ${day(k.lastUsedAt)}` : 'jamais utilisée'}
        </small>
      </div>
      {asking ? (
        <div className="row passkey-confirm" role="group" aria-label={`Retirer la clé ${k.name} ?`}>
          <span>Retirer ?</span>
          <button type="button" className="btn small" disabled={busy} onClick={() => onRemove(k, true)}>
            Oui, retirer
          </button>
          <button type="button" className="btn small ghost" onClick={() => setAsking(false)}>
            Garder
          </button>
        </div>
      ) : (
        <button type="button" className="btn small" disabled={busy} onClick={() => onRemove(k, false) && setAsking(true)}>
          Retirer
        </button>
      )}
    </li>
  );
}

/** Choose a password (none yet) or change it (old one asked). */
function PasswordForm({ token, hasPassword, onDone }: { token: string; hasPassword: boolean; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<{ current?: string; next?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError({});
    const r = await changePassword(token, hasPassword ? current : null, next);
    setBusy(false);
    if (r.ok) return onDone();
    if (r.status === 401) return signOut();
    setError(r.error === 'invalid_password' ? { next: r.message } : r.error === 'bad_credentials' ? { current: r.message } : { form: r.message });
  };
  return (
    <form className="account-form" onSubmit={(e) => void submit(e)} noValidate>
      {hasPassword ? <PasswordField label="Ancien mot de passe" value={current} onChange={setCurrent} autoComplete="current-password" error={error.current} /> : null}
      <PasswordField label="Nouveau mot de passe" value={next} onChange={setNext} autoComplete="new-password" error={error.next} />
      <small className="muted">8 caractères au moins.{hasPassword ? ' Tes autres appareils seront déconnectés.' : ''}</small>
      {error.form ? (
        <p className="field-error" role="alert">
          {error.form}
        </p>
      ) : null}
      <button type="submit" className="btn primary" disabled={busy}>
        Enregistrer le mot de passe
      </button>
    </form>
  );
}

/**
 * "Mon compte" (story 8.2): the account's passkeys (add, remove), the password (choose or change) and "Se déconnecter".
 * Rendered into <body> like the account dialog, so it opens in view on a phone.
 */
export function AccountPanel({ me, onClose }: { me: SignedIn; onClose: () => void }) {
  const { passkeys: canUsePasskeys } = useAccount();
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; quiet?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const reload = useCallback(async () => {
    const r = await accountDetails(me.token);
    if (r.ok) {
      setDetails(r.data);
      setLoadError(null);
    } else if (r.status === 401) {
      signOut();
      onClose();
    } else setLoadError(r.message);
  }, [me.token, onClose]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const r = await addPasskey(me.token);
    setBusy(false);
    if (r.ok) {
      setMessage({ text: 'Clé d’accès ajoutée.', quiet: true });
      void reload();
    } else setMessage({ text: r.message, quiet: r.error === CANCELLED });
  };

  /** First press: checks it is not the last way in, then asks. Second (confirmed): removes. */
  const remove = (k: PasskeyInfo, confirmed: boolean): boolean => {
    setMessage(null);
    if (details && !details.hasPassword && details.passkeys.length <= 1) {
      setMessage({ text: LAST_METHOD });
      return false;
    }
    if (!confirmed) return true;
    setBusy(true);
    void removePasskey(me.token, k.id).then((r) => {
      setBusy(false);
      if (r.ok || r.status === 404) setMessage({ text: 'Clé d’accès retirée.', quiet: true });
      else setMessage({ text: r.message });
      void reload();
    });
    return true;
  };

  const hasPassword = details?.hasPassword ?? false;
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Mon compte">
      <div className="card-panel parchment account-panel my-account">
        <h2>Mon compte</h2>
        <p className="account-who">
          Pseudo : <strong>{me.nickname}</strong>
        </p>
        {loadError ? (
          <p className="field-error" role="alert">
            {loadError}
          </p>
        ) : !details ? (
          <p className="muted">Chargement…</p>
        ) : (
          <>
            <section className="account-section" aria-labelledby="my-keys">
              <h3 id="my-keys">Clés d’accès</h3>
              {details.passkeys.length ? (
                <ul className="passkey-list">
                  {details.passkeys.map((k) => (
                    <PasskeyItem key={k.id} k={k} busy={busy} onRemove={remove} />
                  ))}
                </ul>
              ) : (
                <p className="muted">Aucune clé d’accès. Avec une clé, tu te connectes avec Face ID, ton empreinte ou le code de ton appareil.</p>
              )}
              {message ? (
                <p className={message.quiet ? 'muted quiet-note' : 'field-error'} role={message.quiet ? 'status' : 'alert'}>
                  {message.text}
                </p>
              ) : null}
              {canUsePasskeys ? (
                <button type="button" className="btn" disabled={busy} onClick={() => void add()}>
                  Ajouter une clé d’accès
                </button>
              ) : null}
            </section>
            <section className="account-section" aria-labelledby="my-password">
              <h3 id="my-password">Mot de passe</h3>
              {pwOpen ? (
                <PasswordForm
                  token={me.token}
                  hasPassword={hasPassword}
                  onDone={() => {
                    setPwOpen(false);
                    setPwSaved(true);
                    void reload();
                  }}
                />
              ) : (
                <>
                  {pwSaved ? (
                    <p className="muted quiet-note" role="status">
                      Mot de passe enregistré.
                    </p>
                  ) : null}
                  <p className="muted">{hasPassword ? 'Tu peux aussi te connecter avec ton pseudo et ton mot de passe.' : 'Pas de mot de passe pour l’instant.'}</p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPwOpen(true);
                      setPwSaved(false);
                    }}
                  >
                    {hasPassword ? 'Changer le mot de passe' : 'Choisir un mot de passe'}
                  </button>
                </>
              )}
            </section>
          </>
        )}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            signOut();
            onClose();
          }}
        >
          Se déconnecter
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  );
}
