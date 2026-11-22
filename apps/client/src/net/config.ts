/** Online settings, kept apart from the Colyseus SDK so the SDK loads only when needed. */
const env = import.meta.env as Record<string, string | undefined>;
/** WebSocket URL of the game server; empty = online play disabled in this build. */
export const SERVER_URL: string =
  env.VITE_SERVER_URL ?? (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? `ws://${location.hostname}:2567` : '');

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
