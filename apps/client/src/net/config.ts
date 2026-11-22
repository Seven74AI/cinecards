/** Online settings, kept apart from the Colyseus SDK so the SDK loads only when needed. */
const env = import.meta.env as Record<string, string | undefined>;

/**
 * WebSocket URL of the game server from the build's `VITE_SERVER_URL` and the page's address; empty = online play
 * disabled. `same-origin` (story 8.6: the game served by the server itself) = the page's own host, wss on https.
 * Unset on localhost = the dev server on port 2567.
 */
export function serverUrl(value: string | undefined, loc: Pick<Location, 'protocol' | 'host' | 'hostname'> | undefined): string {
  if (value === 'same-origin') return loc ? `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}` : '';
  if (value !== undefined) return value;
  return loc && (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') ? `ws://${loc.hostname}:2567` : '';
}

/**
 * The game's new address on the old GitHub Pages site (story 8.6, `VITE_MOVED_TO`), keeping an invitation's
 * `?salle=CODE`; null when this build has not moved.
 */
export function movedUrl(movedTo: string | undefined, search: string): string | null {
  if (!movedTo) return null;
  let url: URL;
  try {
    url = new URL(movedTo);
  } catch {
    return null;
  }
  if (url.pathname === '') url.pathname = '/';
  const room = new URLSearchParams(search).get('salle');
  if (room && /^[A-Za-z0-9]{1,8}$/.test(room)) url.searchParams.set('salle', room.toUpperCase());
  return url.href;
}
export const MOVED_URL: string | null = movedUrl(env.VITE_MOVED_TO, typeof location !== 'undefined' ? location.search : '');

/** WebSocket URL of the game server; empty = online play disabled in this build. */
export const SERVER_URL: string = serverUrl(env.VITE_SERVER_URL, typeof location !== 'undefined' ? location : undefined);

/**
 * Seat reconnection tokens, kept in localStorage by room code so a reload or a new tab can come back
 * to a duel (story 11.2). The server only honours a token while the seat is reserved (90 s).
 */
const SEATS_KEY = 'cinecards.seats';
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
type Seats = Record<string, { token: string; at: number }>;

const readSeats = (): Seats => {
  try {
    const raw = JSON.parse(localStorage.getItem(SEATS_KEY) ?? '{}') as Seats;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && typeof v.token === 'string' && now - v.at < MAX_AGE_MS));
  } catch {
    return {};
  }
};
const writeSeats = (seats: Seats) => {
  try {
    localStorage.setItem(SEATS_KEY, JSON.stringify(seats));
  } catch {
    /* ignore */
  }
};

export const seatToken = (code: string): string | null => readSeats()[code.toUpperCase()]?.token ?? null;
export const saveSeat = (code: string, token: string) => writeSeats({ ...readSeats(), [code.toUpperCase()]: { token, at: Date.now() } });
export const forgetSeat = (code: string) => {
  const seats = readSeats();
  delete seats[code.toUpperCase()];
  writeSeats(seats);
};
/** The most recently saved seat, offered as "Reprendre la partie en ligne" on the home screen. */
export const lastSeat = (): { code: string; token: string } | null => {
  const best = Object.entries(readSeats()).sort((a, b) => b[1].at - a[1].at)[0];
  return best ? { code: best[0], token: best[1].token } : null;
};
