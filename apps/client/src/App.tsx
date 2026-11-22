import { useEffect, useState } from 'react';
import { CATALOG } from './game/catalog.ts';
import { localSession, type Session } from './game/session.ts';
import { savedReconnect, SERVER_URL } from './net/config.ts';
import type { OnlineStart } from './net/online.ts';
import { Home, type Start } from './ui/Home.tsx';
import { Table } from './ui/Table.tsx';
import { Lobby } from './ui/Lobby.tsx';

const roomFromUrl = () => new URLSearchParams(location.search).get('salle')?.toUpperCase() ?? undefined;

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lobby, setLobby] = useState(false);

  useEffect(() => () => session?.dispose(), [session]);

  const start = (s: Start) => {
    setError(null);
    if (s.kind === 'hotseat' || s.kind === 'bot') {
      setSession(localSession(CATALOG, { kind: s.kind, mode: s.mode }));
      return;
    }
    let how: OnlineStart;
    if (s.kind === 'reconnect') how = { reconnect: s.token };
    else if (s.kind === 'create') how = { create: true, mode: s.mode, nickname: s.nickname };
    else if (s.kind === 'join') how = { create: false, code: s.code, nickname: s.nickname };
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

  if (session && lobby) return <Lobby session={session} onReady={() => setLobby(false)} onLeave={leave} />;
  if (session) return <Table session={session} onLeave={leave} />;
  return (
    <>
      {error ? (
        <div className="toast" role="alert">
          {error}
        </div>
      ) : null}
      {SERVER_URL && savedReconnect() ? (
        <div className="resume">
          <button type="button" className="btn primary" onClick={() => start({ kind: 'reconnect', token: savedReconnect()! })}>
            Reprendre la partie en ligne
          </button>
        </div>
      ) : null}
      <Home onStart={start} initialCode={roomFromUrl()} onlineAvailable={!!SERVER_URL} />
    </>
  );
}
