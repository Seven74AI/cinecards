import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createAccount, formatRecoveryCode, login, recover, type ApiResult } from './api.ts';
import { signIn } from './session.ts';

export type AccountMode = 'login' | 'create' | 'recover';

type Field = 'nickname' | 'password' | 'code' | 'form';
const FIELD_OF: Record<string, Field> = { invalid_nickname: 'nickname', nickname_taken: 'nickname', invalid_password: 'password' };

const TITLES: Record<AccountMode, string> = { login: 'Se connecter', create: 'Créer un compte', recover: 'Mot de passe oublié ?' };

function PasswordField({ label, value, onChange, autoComplete, error }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; error?: string }) {
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
export function RecoveryCode({ nickname, code, onDone }: { nickname: string; code: string; onDone: () => void }) {
  const [noted, setNoted] = useState(false);
  const [copied, setCopied] = useState(false);
  // printing shows only the sheet with the nickname and the code (see `body.print-code` in styles.css)
  useEffect(() => {
    document.body.classList.add('print-code');
    return () => document.body.classList.remove('print-code');
  }, []);
  return (
    <div className="recovery">
      <p>Voici ton <strong>code de secours</strong>. Il te permet de choisir un nouveau mot de passe si tu oublies le tien. Il ne sera plus jamais affiché : note-le ou imprime-le.</p>
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

/** "Se connecter", "Créer un compte" and "Mot de passe oublié ?" (story 8.1), in the home screen's parchment style. */
export function AccountDialog({ initial, onClose }: { initial: AccountMode; onClose: () => void }) {
  const [mode, setMode] = useState<AccountMode>(initial);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<{ nickname: string; code: string } | null>(null);

  const switchTo = (m: AccountMode) => {
    setMode(m);
    setErrors({});
    setPassword('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    const r: ApiResult<{ token: string; account: { id: number; nickname: string }; recoveryCode?: string }> =
      mode === 'create' ? await createAccount(nickname, password) : mode === 'login' ? await login(nickname, password) : await recover(nickname, code, password);
    setBusy(false);
    if (!r.ok) {
      const field = mode === 'recover' && r.error === 'bad_credentials' ? 'code' : (FIELD_OF[r.error] ?? 'form');
      setErrors({ [field]: r.message });
      return;
    }
    signIn(r.data.token, r.data.account);
    if (r.data.recoveryCode) setShown({ nickname: r.data.account.nickname, code: r.data.recoveryCode });
    else onClose();
  };

  // rendered into <body>: an ancestor of the home screen creates a containing block, which pinned the
  // fixed overlay below the home panel, out of sight on a phone
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label={shown ? 'Code de secours' : TITLES[mode]}>
      <div className="card-panel parchment account-panel">
        <h2>{shown ? 'Ton code de secours' : TITLES[mode]}</h2>
        {shown ? (
          <RecoveryCode nickname={shown.nickname} code={shown.code} onDone={onClose} />
        ) : (
          <form className="account-form" onSubmit={(e) => void submit(e)} noValidate>
            {mode === 'recover' ? <p className="muted">Saisis ton pseudo, ton code de secours et choisis un nouveau mot de passe.</p> : null}
            <TextField label="Pseudo" value={nickname} onChange={setNickname} autoComplete="username" error={errors.nickname} />
            {mode === 'create' ? <small className="muted">3 à 16 caractères : lettres, chiffres, espace, - et _.</small> : null}
            {mode === 'recover' ? <TextField label="Code de secours" value={code} onChange={(v) => setCode(formatRecoveryCode(v))} autoComplete="off" error={errors.code} mono /> : null}
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
            <button type="submit" className="btn primary" disabled={busy}>
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
                    Mot de passe oublié ?
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
