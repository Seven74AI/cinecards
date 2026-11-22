import { useEffect, useState } from 'react';
import { CATALOG } from './game/catalog.ts';
import { localSession, type Session } from './game/session.ts';
import { lastSeat, SERVER_URL } from './net/config.ts';
import type { OnlineStart } from './net/online.ts';
import { Home, type Start } from './ui/Home.tsx';
import { Table } from './ui/Table.tsx';
import { Lobby } from './ui/Lobby.tsx';

const roomFromUrl = () => new URLSearchParams(location.search).get('salle')?.toUpperCase() ?? undefined;

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lobby, setLobby] = useState(false);
  // keep the code typed for a join that failed, so the player can fix it or retry
  const [lastCode, setLastCode] = useState<string | undefined>(undefined);

  useEffect(() => () => session?.dispose(), [session]);

  // dev server only: `?scene=<name>` opens a prepared solo position for the e2e tests (story 12.1); story 13.12: also
  // in a production build made with VITE_SCENES=1, so `scripts/perf-phone.mjs` times the real (minified) client
  useEffect(() => {
    if (!import.meta.env.DEV && !import.meta.env.VITE_SCENES) return;
    const name = new URLSearchParams(location.search).get('scene');
    if (!name) return;
    void import('./game/devscene.ts').then(({ devScene, devBotSeed }) => {
      const initial = devScene(CATALOG, name);
      if (initial) setSession(localSession(CATALOG, { kind: 'bot', mode: 'shared', initial, seed: devBotSeed(name) }));
    });
  }, []);

  const start = (s: Start) => {
    setError(null);
    if (s.kind === 'hotseat' || s.kind === 'bot') {
      setSession(localSession(CATALOG, { kind: s.kind, mode: s.mode }));
      return;
    }
    let how: OnlineStart;
    if (s.kind === 'reconnect') how = { reconnect: s.token };
    else if (s.kind === 'create') how = { create: true, mode: s.mode, nickname: s.nickname, session: s.session };
    else if (s.kind === 'join') {
      how = { create: false, code: s.code, nickname: s.nickname, session: s.session };
      setLastCode(s.code);
    }
    else return;
    void import('./net/online.ts').then(({ onlineSession }) => {
      const sess = onlineSession(CATALOG, how, (msg) => {
        setError(msg);
        setSession(null);
        setLobby(false);
      });
      setSession(sess);
      setLobby(true);
    });
  };

  const leave = () => {
    session?.dispose();
    setSession(null);
    setLobby(false);
    if (location.search) history.replaceState(null, '', location.pathname);
  };

  const seat = lastSeat();
  if (session && lobby) return <Lobby session={session} onReady={() => setLobby(false)} onLeave={leave} />;
  if (session) return <Table session={session} onLeave={leave} />;
  return (
    <>
      {error ? (
        <div className="toast" role="alert">
          {error}
        </div>
      ) : null}
      {SERVER_URL && seat ? (
        <div className="resume">
          <button type="button" className="btn primary" onClick={() => start({ kind: 'reconnect', token: seat.token })}>
            Reprendre la partie en ligne (salle {seat.code})
          </button>
        </div>
      ) : null}
      <Home onStart={start} initialCode={lastCode ?? roomFromUrl()} onlineAvailable={!!SERVER_URL} />
    </>
  );
}
