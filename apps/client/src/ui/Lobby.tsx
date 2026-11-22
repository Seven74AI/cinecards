import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Session } from '../game/session.ts';
import { Icon } from './Icon.tsx';

/** Waiting room: shows the code and the invitation link until the opponent arrives (story 6.2). */
export function Lobby({ session, onReady, onLeave }: { session: Session; onReady: () => void; onLeave: () => void }) {
  const snap = useSyncExternalStore(session.subscribe, session.get);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (snap.status === 'playing' || snap.status === 'opponentAway') onReady();
  }, [snap.status, onReady]);
  const code = snap.roomCode;
  const link = code ? `${location.origin}${location.pathname}?salle=${code}` : '';
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'CineCards', text: `Viens m’affronter sur CineCards ! Code : ${code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      /* cancelled */
    }
  };
  return (
    <div className="home">
      <section className="home-panel parchment lobby">
        <h2>{snap.status === 'connecting' ? 'Connexion…' : 'Salle de duel'}</h2>
        {code ? (
          <>
            <p>Donne ce code à ton adversaire :</p>
            <div className="big-code" aria-label={`Code ${code.split('').join(' ')}`}>
              {code}
            </div>
            <button type="button" className="btn primary" onClick={share}>
              {copied ? 'Lien copié !' : 'Partager le lien d’invitation'}
            </button>
            <ul className="seats">
              {(snap.seats ?? [null, null]).map((n, i) => (
                <li key={i} className={n ? 'on' : ''}>
                  <Icon name={n ? 'crown' : 'hourglass'} size={14} /> {n ?? 'En attente…'}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Ouverture du grimoire…</p>
        )}
        <button type="button" className="btn ghost" onClick={onLeave}>
          Annuler
        </button>
      </section>
    </div>
  );
}
