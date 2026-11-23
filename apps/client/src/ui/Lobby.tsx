import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Session } from '../game/session.ts';
import { useHub, type SentInvite } from '../account/hub.ts';
import { modeLabel } from '../account/historyFormat.ts';
import { useAccount } from '../account/session.ts';
import { defaultDeck, lastDeckId, rememberDeck, usePlayableDecks } from '../decks/playable.ts';
import { CATALOG, PLAYABLE } from '../game/catalog.ts';
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

/**
 * Story 10.3: the deck of a constructed room. "Choisis ton deck" until the server holds one for me (only its id is
 * sent), then its name with "Changer", and whether the other player has chosen theirs.
 */
function DeckChoice({ session }: { session: Session }) {
  const snap = useSyncExternalStore(session.subscribe, session.get);
  const { signedIn } = useAccount();
  const decks = usePlayableDecks(signedIn?.token ?? null, CATALOG, PLAYABLE);
  const [picked, setPicked] = useState<number | null>(lastDeckId);
  const [changing, setChanging] = useState(false);
  const [sent, setSent] = useState(false);
  const refused = snap.deckRefused?.message ?? null;
  useEffect(() => {
    // the server answered: a refusal, or the deck it now holds
    setSent(false);
    if (!snap.needDeck) setChanging(false);
  }, [snap.deckRefused, snap.deckId, snap.needDeck]);
  const me = snap.viewer;
  const other = me === 0 ? 1 : 0;
  const otherName = snap.seats?.[other] ?? null;
  const mine = decks?.find((d) => d.id === snap.deckId) ?? null;
  const choice = decks ? defaultDeck(decks, picked) : null;
  const picking = snap.needDeck || changing;
  return (
    <div className="lobby-deck">
      {picking ? (
        <fieldset className="modes deck-choice">
          <legend>Choisis ton deck</legend>
          {decks === null ? <p className="muted">Chargement de tes decks…</p> : null}
          {decks && !decks.length ? <p className="field-error">Tu n’as aucun deck valide : construis-en un dans « Mes decks ».</p> : null}
          {decks?.map((d) => (
            <label key={d.id} className={choice?.id === d.id ? 'on' : ''}>
              <input type="radio" name="deck" checked={choice?.id === d.id} onChange={() => setPicked(d.id)} /> {d.name}
            </label>
          ))}
          {refused ? (
            <p className="field-error" role="alert">
              {refused}
            </p>
          ) : null}
          <button
            type="button"
            className="btn primary"
            disabled={!choice || sent}
            onClick={() => {
              if (!choice || !session.chooseDeck) return;
              rememberDeck(choice.id);
              setSent(true);
              session.chooseDeck(choice.id);
            }}
          >
            Jouer ce deck
          </button>
        </fieldset>
      ) : (
        <>
          {refused ? (
            <p className="field-error" role="alert">
              {refused}
            </p>
          ) : null}
          <p className="lobby-my-deck">
            Ton deck : <strong>{mine?.name ?? 'choisi'}</strong>{' '}
            <button type="button" className="link" onClick={() => setChanging(true)}>
              Changer
            </button>
          </p>
        </>
      )}
      {otherName && !snap.deckChosen?.[other] ? (
        <p className="muted" role="status">
          En attente du deck de {otherName}…
        </p>
      ) : null}
    </div>
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
  const constructed = snap.mode === 'constructed';
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
            {snap.mode ? <p className="lobby-mode">Pioche : {modeLabel(snap.mode)}</p> : null}
            <ul className="seats">
              {(snap.seats ?? [null, null]).map((n, i) => (
                <li key={i} className={n ? 'on' : ''}>
                  <Icon name={n ? 'crown' : 'hourglass'} size={14} /> {n ?? 'En attente…'}
                  {constructed && n ? <small className="seat-deck">{snap.deckChosen?.[i] ? 'deck prêt' : 'choisit son deck…'}</small> : null}
                </li>
              ))}
            </ul>
            {constructed ? <DeckChoice session={session} /> : null}
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
