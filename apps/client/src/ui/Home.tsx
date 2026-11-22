import { useState } from 'react';
import type { DeckMode } from '@cinecards/engine';
import { CATALOG, PLAYABLE, SET_TITLES } from '../game/catalog.ts';
import { AccountDialog, type AccountMode } from '../account/AccountDialog.tsx';
import { AccountPanel } from '../account/AccountPanel.tsx';
import { signOut, useAccount } from '../account/session.ts';
import { MOVED_URL } from '../net/config.ts';
import { CardView } from './CardView.tsx';
import { useRefs } from './Refs.tsx';

export type Start =
  | { kind: 'hotseat' | 'bot'; mode: DeckMode }
  | { kind: 'create'; mode: DeckMode; nickname: string; session?: string }
  | { kind: 'join'; code: string; nickname: string; session?: string }
  | { kind: 'reconnect'; token: string };

const savedNick = () => {
  try {
    return localStorage.getItem('cinecards.nick') ?? '';
  } catch {
    return '';
  }
};

export function Home({ onStart, initialCode, onlineAvailable }: { onStart: (s: Start) => void; initialCode?: string; onlineAvailable: boolean }) {
  const [mode, setMode] = useState<DeckMode>('shared');
  const [nickname, setNickname] = useState(savedNick());
  const [code, setCode] = useState(initialCode ?? '');
  const [tab, setTab] = useState<'local' | 'online'>(initialCode ? 'online' : 'local');
  const [showCards, setShowCards] = useState(false);
  const [dialog, setDialog] = useState<AccountMode | null>(null);
  const [panel, setPanel] = useState(false);
  const { openCard, openRules } = useRefs();
  // signed in (story 8.1): the server takes the nickname from the session token
  const { available: accountsOn, signedIn, manage } = useAccount();
  const nick = signedIn ? signedIn.nickname : nickname.trim() || 'Invité';
  const session = signedIn ? { session: signedIn.token } : {};
  const remember = () => {
    try {
      localStorage.setItem('cinecards.nick', nickname.trim());
    } catch {
      /* ignore */
    }
  };
  const showcase = ['mx-neo', 'hg-arthur', 'hs-topper', 'wc-latrell'].map((id) => CATALOG.get(id)).filter((c) => !!c);
  return (
    <div className="home">
      <div className="ambient" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="ember" style={{ left: `${(i * 29) % 100}%`, animationDelay: `${(i * 1.3) % 9}s` }} />
        ))}
      </div>
      {MOVED_URL ? (
        // old GitHub Pages site only (story 8.6): the game stays playable here during the move
        <aside className="moved-banner parchment" role="note">
          <p>
            CineCards a déménagé : <strong>cinecards.sevend.io</strong>
          </p>
          <a className="btn primary" href={MOVED_URL}>
            Y aller
          </a>
        </aside>
      ) : null}
      <header className="home-title">
        <span className="seal-big" aria-hidden="true" />
        <h1>CineCards</h1>
        <p>Le grimoire des duels de cinéma</p>
      </header>
      <div className="showcase" aria-hidden="true">
        {showcase.map((c, i) => (
          <span key={c.id} className="fan" style={{ transform: `rotate(${(i - 1.5) * 9}deg) translateY(${Math.abs(i - 1.5) * 8}px)` }}>
            <CardView card={c} size="hand" />
          </span>
        ))}
      </div>
      <section className="home-panel parchment">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'local'} className={tab === 'local' ? 'on' : ''} onClick={() => setTab('local')}>
            Sur cet appareil
          </button>
          <button type="button" role="tab" aria-selected={tab === 'online'} className={tab === 'online' ? 'on' : ''} onClick={() => setTab('online')}>
            En ligne
          </button>
        </div>
        {tab === 'local' || (tab === 'online' && !code) ? (
          <fieldset className="modes">
            <legend>Pioche</legend>
            <label className={mode === 'shared' ? 'on' : ''}>
              <input type="radio" name="mode" checked={mode === 'shared'} onChange={() => setMode('shared')} /> Pioche commune
              <small>Les deux joueurs piochent dans le même paquet.</small>
            </label>
            <label className={mode === 'randomSplit' ? 'on' : ''}>
              <input type="radio" name="mode" checked={mode === 'randomSplit'} onChange={() => setMode('randomSplit')} /> Decks aléatoires
              <small>Le paquet est coupé en deux : chacun sa pioche.</small>
            </label>
          </fieldset>
        ) : null}
        {tab === 'local' ? (
          <div className="home-actions">
            <button type="button" className="btn primary" onClick={() => onStart({ kind: 'hotseat', mode })}>
              Duel à deux sur ce téléphone
            </button>
            <button type="button" className="btn" onClick={() => onStart({ kind: 'bot', mode })}>
              S’entraîner contre le Grimoire
            </button>
          </div>
        ) : (
          <div className="home-actions">
            {signedIn ? (
              <p className="account-line">
                <span>
                  Connecté :{' '}
                  {manage ? (
                    // story 8.2: the nickname opens "Mon compte"
                    <button type="button" className="link account-nick" aria-label={`Mon compte (${signedIn.nickname})`} onClick={() => setPanel(true)}>
                      <strong>{signedIn.nickname}</strong>
                    </button>
                  ) : (
                    <strong>{signedIn.nickname}</strong>
                  )}
                </span>
                <button type="button" className="link" onClick={signOut}>
                  Se déconnecter
                </button>
              </p>
            ) : (
              <>
                <label className="field">
                  Ton pseudo
                  <input value={nickname} maxLength={16} onChange={(e) => setNickname(e.target.value)} placeholder="Invité" />
                </label>
                {accountsOn ? (
                  <p className="account-links">
                    <button type="button" className="link" onClick={() => setDialog('login')}>
                      Se connecter
                    </button>
                    <button type="button" className="link" onClick={() => setDialog('create')}>
                      Créer un compte
                    </button>
                  </p>
                ) : null}
              </>
            )}
            {!onlineAvailable ? <p className="muted">Le serveur en ligne n’est pas configuré pour cette version.</p> : null}
            <button
              type="button"
              className="btn primary"
              disabled={!onlineAvailable}
              onClick={() => {
                remember();
                onStart({ kind: 'create', mode, nickname: nick, ...session });
              }}
            >
              Créer un duel et inviter
            </button>
            <div className="join">
              <input aria-label="Code de la salle" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="CODE" />
              <button
                type="button"
                className="btn"
                disabled={!onlineAvailable || code.length < 4}
                onClick={() => {
                  remember();
                  onStart({ kind: 'join', code, nickname: nick, ...session });
                }}
              >
                Rejoindre
              </button>
            </div>
          </div>
        )}
      </section>
      {dialog ? <AccountDialog initial={dialog} onClose={() => setDialog(null)} /> : null}
      {panel && signedIn ? <AccountPanel me={signedIn} onClose={() => setPanel(false)} /> : null}
      <button type="button" className="link" onClick={() => setShowCards((v) => !v)}>
        {showCards ? 'Masquer les cartes' : `Voir les ${PLAYABLE.length} cartes`}
      </button>
      <button type="button" className="link" onClick={openRules}>
        Règles et mots-clés
      </button>
      {showCards ? (
        <div className="collection">
          {Object.keys(SET_TITLES).map((set) => (
            <section key={set}>
              <h3>{SET_TITLES[set]}</h3>
              <div className="collection-grid">
                {[...CATALOG.values()]
                  .filter((c) => c.set === set)
                  .map((c) => (
                    <CardView key={c.id} card={c} size="hand" onClick={() => openCard(c.id)} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
