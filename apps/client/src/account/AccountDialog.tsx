import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createAccount, formatRecoveryCode, login, recover, type ApiResult } from './api.ts';
import { addPasskey, CANCELLED, createWithPasskey, loginWithPasskey } from './passkeys.ts';
import { signIn, useAccount } from './session.ts';

export type AccountMode = 'login' | 'create' | 'recover';

type Field = 'nickname' | 'password' | 'code' | 'form';
const FIELD_OF: Record<string, Field> = { invalid_nickname: 'nickname', nickname_taken: 'nickname', invalid_password: 'password' };

const TITLES: Record<AccountMode, string> = { login: 'Se connecter', create: 'Créer un compte', recover: 'Mot de passe oublié ?' };
/** Story 8.2: with passkeys the recovery code also gives a new key. */
const RECOVER_PASSKEYS = 'Mot de passe ou clé perdus ?';

export function PasswordField({ label, value, onChange, autoComplete, error }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; error?: string }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-row">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          maxLength={128}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn small" aria-pressed={shown} onClick={() => setShown((v) => !v)}>
          {shown ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {error ? (
        <span id={`${id}-err`} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function TextField({ label, value, onChange, autoComplete, error, mono }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; error?: string; mono?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={mono ? 'mono' : undefined}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <span id={`${id}-err`} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** The recovery code, shown once (story 8.1): copy, print, and a box to tick before going on. */
export function RecoveryCode({ nickname, code, note, onDone }: { nickname: string; code: string; note?: string | null; onDone: () => void }) {
  const [noted, setNoted] = useState(false);
  const [copied, setCopied] = useState(false);
  // printing shows only the sheet with the nickname and the code (see `body.print-code` in styles/account.css)
  useEffect(() => {
    document.body.classList.add('print-code');
    return () => document.body.classList.remove('print-code');
  }, []);
  return (
    <div className="recovery">
      {note ? (
        <p className="muted" role="status">
          {note}
        </p>
      ) : null}
      <p>
        Voici ton <strong>code de secours</strong>. Il te permet de retrouver ton compte si tu perds ton mot de passe ou ta clé d’accès. Il ne sera plus jamais affiché : note-le ou
        imprime-le.
      </p>
      <div className="recovery-sheet">
        <span className="recovery-for">CineCards · {nickname}</span>
        <code className="recovery-code" aria-label="Code de secours">
          {/* one unbreakable span per group, so a narrow screen wraps between groups, never inside one */}
          {code.split('-').map((g, i, all) => (
            <span key={i}>{i < all.length - 1 ? `${g}-` : g}</span>
          ))}
        </code>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? 'Copié !' : 'Copier'}
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} /> J’ai noté mon code
      </label>
      <button type="button" className="btn primary" disabled={!noted} onClick={onDone}>
        Continuer
      </button>
    </div>
  );
}

/**
 * "Se connecter", "Créer un compte" and "Mot de passe oublié ?" (story 8.1), in the home screen's parchment style.
 * Story 8.2 adds the passkey buttons, shown only when the server and the browser support passkeys; the password form
 * stays on the same screen, below an "ou" line.
 */
export function AccountDialog({ initial, onClose }: { initial: AccountMode; onClose: () => void }) {
  const { passkeys } = useAccount();
  const [mode, setMode] = useState<AccountMode>(initial);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<{ nickname: string; code: string; note?: string | null } | null>(null);

  const switchTo = (m: AccountMode) => {
    setMode(m);
    setErrors({});
    setNote(null);
    setPassword('');
  };

  const showError = (r: { error: string; message: string }) => {
    if (r.error === CANCELLED) return setNote(r.message);
    const field = mode === 'recover' && r.error === 'bad_credentials' ? 'code' : (FIELD_OF[r.error] ?? 'form');
    setErrors({ [field]: r.message });
  };

  const done = (r: ApiResult<{ token: string; account: { id: number; nickname: string }; recoveryCode?: string }>, keyNote?: string | null) => {
    if (!r.ok) return showError(r);
    signIn(r.data.token, r.data.account);
    if (r.data.recoveryCode) setShown({ nickname: r.data.account.nickname, code: r.data.recoveryCode, note: keyNote });
    else onClose();
  };

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setErrors({});
    setNote(null);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      done(mode === 'create' ? await createAccount(nickname, password) : mode === 'login' ? await login(nickname, password) : await recover(nickname, code, password));
    });
  };

  /** The passkey button of each mode: sign in, create the account, or (after the recovery code) a new key. */
  const withPasskey = () =>
    void run(async () => {
      if (mode === 'login') return done(await loginWithPasskey());
      if (mode === 'create') return done(await createWithPasskey(nickname));
      // the code is checked first; once it is, the account is ours again whatever the device answers
      const r = await recover(nickname, code);
      if (!r.ok) return showError(r);
      signIn(r.data.token, r.data.account);
      const k = await addPasskey(r.data.token);
      const keyNote = k.ok
        ? null
        : k.error === CANCELLED
          ? 'Demande annulée : aucune clé ajoutée. Tu peux en ajouter une depuis « Mon compte ».'
          : `${k.message} Tu peux réessayer depuis « Mon compte ».`;
      done(r, keyNote);
    });

  const title = mode === 'recover' && passkeys ? RECOVER_PASSKEYS : TITLES[mode];
  const passkeyButton = passkeys ? (
    <>
      <button type="button" className="btn primary" disabled={busy} onClick={withPasskey}>
        {mode === 'login' ? 'Se connecter avec une clé d’accès' : mode === 'create' ? 'Avec une clé d’accès (recommandé)' : 'Nouvelle clé d’accès'}
      </button>
      {note ? (
        <p className="muted quiet-note" role="status">
          {note}
        </p>
      ) : null}
      <p className="or-line">
        <span>{mode === 'login' ? 'ou avec ton mot de passe' : mode === 'create' ? 'ou avec un mot de passe' : 'ou un nouveau mot de passe'}</span>
      </p>
    </>
  ) : null;

  // rendered into <body>: an ancestor of the home screen creates a containing block, which pinned the
  // fixed overlay below the home panel, out of sight on a phone
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={shown ? 'Code de secours' : title}>
      <div className="card-panel parchment account-panel">
        <h2>{shown ? 'Ton code de secours' : title}</h2>
        {shown ? (
          <RecoveryCode nickname={shown.nickname} code={shown.code} note={shown.note} onDone={onClose} />
        ) : (
          <form className="account-form" onSubmit={submit} noValidate>
            {mode === 'recover' ? (
              <p className="muted">
                {passkeys
                  ? 'Saisis ton pseudo et ton code de secours, puis choisis une nouvelle clé d’accès ou un nouveau mot de passe.'
                  : 'Saisis ton pseudo, ton code de secours et choisis un nouveau mot de passe.'}
              </p>
            ) : null}
            {mode === 'login' ? passkeyButton : null}
            <TextField label="Pseudo" value={nickname} onChange={setNickname} autoComplete="username" error={errors.nickname} />
            {mode === 'create' ? <small className="muted">3 à 16 caractères : lettres, chiffres, espace, - et _.</small> : null}
            {mode === 'recover' ? <TextField label="Code de secours" value={code} onChange={(v) => setCode(formatRecoveryCode(v))} autoComplete="off" error={errors.code} mono /> : null}
            {mode !== 'login' ? passkeyButton : null}
            <PasswordField
              label={mode === 'recover' ? 'Nouveau mot de passe' : 'Mot de passe'}
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              error={errors.password}
            />
            {errors.form ? (
              <p className="field-error" role="alert">
                {errors.form}
              </p>
            ) : null}
            <button type="submit" className={passkeys ? 'btn' : 'btn primary'} disabled={busy}>
              {mode === 'create' ? 'Créer mon compte' : mode === 'login' ? 'Me connecter' : 'Changer le mot de passe'}
            </button>
            <div className="account-links">
              {mode !== 'login' ? (
                <button type="button" className="link" onClick={() => switchTo('login')}>
                  J’ai déjà un compte
                </button>
              ) : (
                <>
                  <button type="button" className="link" onClick={() => switchTo('recover')}>
                    {passkeys ? RECOVER_PASSKEYS : TITLES.recover}
                  </button>
                  <button type="button" className="link" onClick={() => switchTo('create')}>
                    Créer un compte
                  </button>
                </>
              )}
            </div>
            <button type="button" className="btn ghost" onClick={onClose}>
              Annuler
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
