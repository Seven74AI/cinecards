import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Session } from '../game/session.ts';
import { useHub, type SentInvite } from '../account/hub.ts';
import { Icon } from './Icon.tsx';

/** Where the invitation sent from "Amis" stands (story 8.3). */
function InviteStatus({ sent }: { sent: SentInvite }) {
  const who = <strong>{sent.to.nickname}</strong>;
  if (sent.state === 'declined')
    return (
      <p className="invite-status" role="status">
        {who} a refusé.
      </p>
    );
  if (sent.state === 'expired')
    return (
      <p className="invite-status" role="status">
        L’invitation à {who} a expiré.
      </p>
    );
  if (sent.state === 'failed')
    return (
      <p className="invite-status field-error" role="alert">
        {sent.message ?? 'L’invitation n’a pas pu partir.'}
      </p>
    );
  return (
    <p className="invite-status" role="status">
      {sent.state === 'sending' ? <>Invitation pour {who}…</> : <>Invitation envoyée à {who}</>}
    </p>
  );
}

/** Waiting room: shows the code and the invitation link until the opponent arrives (story 6.2). */
export function Lobby({ session, onReady, onLeave }: { session: Session; onReady: () => void; onLeave: () => void }) {
  const snap = useSyncExternalStore(session.subscribe, session.get);
  const [copied, setCopied] = useState(false);
  const { sent } = useHub();
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
            {sent && (sent.roomCode === null || sent.roomCode === code) ? <InviteStatus sent={sent} /> : null}
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
