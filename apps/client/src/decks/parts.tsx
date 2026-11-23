import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DeckValidation } from '@cinecards/cards';
import { shortError } from './filters.ts';
import { DeckIcon } from './icons.tsx';

/** "Valide" in green, or the first problem in red ("Il manque 3 cartes"). */
export function DeckStatus({ validation, variant }: { validation: DeckValidation | { ok: boolean; errors: string[] }; variant: 'dock' | 'pill' | 'line' }) {
  const first = validation.ok ? null : (validation as { errors: (string | { message: string })[] }).errors[0];
  const text = first ? shortError(typeof first === 'string' ? first : first.message) : 'Valide';
  const cls = { dock: validation.ok ? 'deck-st-ok' : 'deck-err2', pill: validation.ok ? 'deck-okp' : 'deck-errp', line: validation.ok ? 'deck-st-ok' : 'deck-st-bad' }[variant];
  return (
    <span className={'deck-status ' + cls} role="status">
      <DeckIcon name={validation.ok ? 'check' : 'warn'} size={14} width={validation.ok ? 3 : 2.6} />
      {text}
    </span>
  );
}

/** Centered confirmation on a dark scrim (mockup "Supprimer ce deck ?"). */
export function ConfirmDialog({
  title,
  children,
  confirm,
  cancel = 'Annuler',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <>
      <div className="deck-scrim strong" aria-hidden="true" onClick={onCancel} />
      <div className="deck-dlg" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{children}</p>
        <div className="deck-dlg-actions">
          <button type="button" ref={ref} className="deck-btn outline" onClick={onCancel}>
            {cancel}
          </button>
          <button type="button" className={'deck-btn ' + (danger ? 'red' : 'gold')} onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </div>
    </>
  );
}

/** A short message above the bottom bar, gone after a moment. */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; error: boolean; key: number } | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.error ? 4000 : 2200);
    return () => clearTimeout(t);
  }, [msg]);
  const show = (text: string, error = false) => setMsg({ text, error, key: Date.now() });
  const toast = msg ? (
    <div key={msg.key} className={'deck-toast' + (msg.error ? ' err' : '')} role={msg.error ? 'alert' : 'status'}>
      {msg.text}
    </div>
  ) : null;
  return { toast, show };
}
