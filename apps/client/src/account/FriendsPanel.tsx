import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { FriendRef, Presence } from '@cinecards/protocol';
import { acceptFriend, removeFriend, requestFriend } from './api.ts';
import { refreshFriends, useHub } from './hub.ts';
import { signOut, type SignedIn } from './session.ts';

const PRESENCE_LABEL: Record<Presence, string> = { online: 'en ligne', inGame: 'en partie', offline: 'hors ligne' };

/** One friend: presence dot, "Inviter" when green, "Retirer" with an inline confirmation. */
function FriendItem({ f, busy, onInvite, onRemove }: { f: FriendRef & { presence: Presence }; busy: boolean; onInvite: () => void; onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <li className="friend-item">
      <span className={`presence-dot ${f.presence}`} aria-hidden="true" />
      <div className="friend-text">
        <strong>{f.nickname}</strong>
        <small className="muted">{PRESENCE_LABEL[f.presence]}</small>
      </div>
      {asking ? (
        <div className="row friend-actions" role="group" aria-label={`Retirer ${f.nickname} de tes amis ?`}>
          <button type="button" className="btn small" disabled={busy} onClick={onRemove}>
            Oui, retirer
          </button>
          <button type="button" className="btn small ghost" onClick={() => setAsking(false)}>
            Garder
          </button>
        </div>
      ) : (
        <div className="row friend-actions">
          {f.presence === 'online' ? (
            <button type="button" className="btn small primary" disabled={busy} aria-label={`Inviter ${f.nickname}`} onClick={onInvite}>
              Inviter
            </button>
          ) : null}
          <button type="button" className="btn small ghost" disabled={busy} aria-label={`Retirer ${f.nickname}`} onClick={() => setAsking(true)}>
            Retirer
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * "Amis" (story 8.3): add a friend by nickname, answer requests, see who is online and invite a friend to a duel.
 * Rendered into <body> like "Mon compte", so it opens in view on a phone.
 */
export function FriendsPanel({ me, onClose, onInvite }: { me: SignedIn; onClose: () => void; onInvite: (friend: FriendRef) => void }) {
  const { list } = useHub();
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState<{ text: string; quiet?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshFriends();
  }, []);

  /** Runs one change, then reads the list again (the hub also says so). */
  const act = async (run: () => Promise<{ ok: boolean; status?: number; error?: string; message?: string }>, done?: string) => {
    if (busy) return false;
    setBusy(true);
    setMessage(null);
    const r = await run();
    setBusy(false);
    if (!r.ok && r.status === 401) {
      signOut();
      onClose();
      return false;
    }
    // a request that no longer exists (answered elsewhere) only needs the list read again
    if (!r.ok && r.error !== 'not_found') setMessage({ text: r.message ?? 'Erreur du serveur. Réessaie plus tard.' });
    else if (done) setMessage({ text: done, quiet: true });
    void refreshFriends();
    return r.ok;
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const nick = nickname.trim();
    if (!nick) return;
    let accepted = false;
    const ok = await act(async () => {
      const r = await requestFriend(me.token, nick);
      accepted = r.ok && r.data.status === 'accepted';
      return r;
    });
    if (ok) {
      setNickname('');
      setMessage({ text: accepted ? `Vous êtes maintenant amis.` : `Demande envoyée à ${nick}.`, quiet: true });
    }
  };

  const incoming = list?.incoming ?? [];
  const outgoing = list?.outgoing ?? [];
  const friends = list?.friends ?? [];
  const empty = list && !incoming.length && !outgoing.length && !friends.length;
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Amis">
      <div className="card-panel parchment account-panel friends-panel">
        <h2>Amis</h2>
        <form className="friend-add" onSubmit={(e) => void add(e)} noValidate>
          <label className="field">
            Pseudo d’un joueur
            <input value={nickname} maxLength={16} autoComplete="off" autoCapitalize="none" onChange={(e) => setNickname(e.target.value)} placeholder="Pseudo exact" />
          </label>
          <button type="submit" className="btn primary" disabled={busy || !nickname.trim()}>
            Ajouter
          </button>
        </form>
        {message ? (
          <p className={message.quiet ? 'muted quiet-note' : 'field-error'} role={message.quiet ? 'status' : 'alert'}>
            {message.text}
          </p>
        ) : null}
        {!list ? <p className="muted">Chargement…</p> : null}
        {empty ? <p className="muted">Ajoute un ami avec son pseudo.</p> : null}
        {incoming.length ? (
          <section className="account-section" aria-labelledby="friends-incoming">
            <h3 id="friends-incoming">Demandes reçues</h3>
            <ul className="friend-list">
              {incoming.map((f) => (
                <li key={f.id} className="friend-item">
                  <div className="friend-text">
                    <strong>{f.nickname}</strong>
                    <small className="muted">veut être ton ami</small>
                  </div>
                  <div className="row friend-actions">
                    <button type="button" className="btn small primary" disabled={busy} aria-label={`Accepter ${f.nickname}`} onClick={() => void act(() => acceptFriend(me.token, f.id), `${f.nickname} est maintenant ton ami.`)}>
                      Accepter
                    </button>
                    <button type="button" className="btn small ghost" disabled={busy} aria-label={`Refuser ${f.nickname}`} onClick={() => void act(() => removeFriend(me.token, f.id))}>
                      Refuser
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {friends.length ? (
          <section className="account-section" aria-labelledby="friends-list">
            <h3 id="friends-list">Mes amis</h3>
            <ul className="friend-list">
              {friends.map((f) => (
                <FriendItem
                  key={f.id}
                  f={f}
                  busy={busy}
                  onInvite={() => onInvite({ id: f.id, nickname: f.nickname })}
                  onRemove={() => void act(() => removeFriend(me.token, f.id), `${f.nickname} n’est plus dans tes amis.`)}
                />
              ))}
            </ul>
          </section>
        ) : null}
        {outgoing.length ? (
          <section className="account-section" aria-labelledby="friends-outgoing">
            <h3 id="friends-outgoing">Demandes envoyées</h3>
            <ul className="friend-list">
              {outgoing.map((f) => (
                <li key={f.id} className="friend-item">
                  <div className="friend-text">
                    <strong>{f.nickname}</strong>
                    <small className="muted">en attente</small>
                  </div>
                  <button type="button" className="btn small ghost" disabled={busy} aria-label={`Annuler la demande à ${f.nickname}`} onClick={() => void act(() => removeFriend(me.token, f.id))}>
                    Annuler
                  </button>
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
