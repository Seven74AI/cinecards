import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { history, type HistoryList } from './api.ts';
import { modeLabel, opponentLabel, relativeDate, RESULT_LABEL, RESULT_TONE, turnsLabel } from './historyFormat.ts';
import { signOut, type SignedIn } from './session.ts';

/**
 * "Historique" (story 8.4): my record and my latest 20 online games, newest first.
 * Rendered into <body> like "Mon compte" and "Amis", so it opens in view on a phone.
 */
export function HistoryPanel({ me, onClose }: { me: SignedIn; onClose: () => void }) {
  const [list, setList] = useState<HistoryList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    let live = true;
    void history(me.token).then((r) => {
      if (!live) return;
      if (r.ok) setList(r.data);
      else if (r.status === 401) {
        signOut();
        close.current();
      } else setError(r.message);
    });
    return () => {
      live = false;
    };
  }, [me.token]);

  const now = Date.now();
  const r = list?.record;
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Historique">
      <div className="card-panel parchment account-panel history-panel">
        <h2>Historique</h2>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        {!list && !error ? <p className="muted">Chargement…</p> : null}
        {r ? (
          <dl className="history-record" aria-label="Mon bilan">
            <div className="win">
              <dt>Victoires</dt>
              <dd>{r.wins}</dd>
            </div>
            <div className="loss">
              <dt>Défaites</dt>
              <dd>{r.losses}</dd>
            </div>
            <div className="draw">
              <dt>Nulles</dt>
              <dd>{r.draws}</dd>
            </div>
          </dl>
        ) : null}
        {list && !list.games.length ? <p className="muted history-empty">Aucune partie en ligne pour l’instant.</p> : null}
        {list?.games.length ? (
          <section className="account-section" aria-labelledby="history-latest">
            <h3 id="history-latest">Dernières parties</h3>
            <ul className="history-list">
              {list.games.map((g) => (
                <li key={g.id} className="history-item">
                  <span className={`result-dot ${RESULT_TONE[g.result]}`} aria-hidden="true" />
                  <div className="history-text">
                    <span className="history-line">
                      <strong className={`history-result ${RESULT_TONE[g.result]}`}>{RESULT_LABEL[g.result]}</strong>
                      <span className="history-vs">
                        contre <strong>{opponentLabel(g.opponent)}</strong>
                      </span>
                    </span>
                    <small className="muted">
                      {modeLabel(g.mode)} · {turnsLabel(g.turns)} · <time dateTime={new Date(g.endedAt).toISOString()}>{relativeDate(g.endedAt, now)}</time>
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <button type="button" className="btn primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  );
}
