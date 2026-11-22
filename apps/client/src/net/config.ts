/** Online settings, kept apart from the Colyseus SDK so the SDK loads only when needed. */
const env = import.meta.env as Record<string, string | undefined>;
/** WebSocket URL of the game server; empty = online play disabled in this build. */
export const SERVER_URL: string =
  env.VITE_SERVER_URL ?? (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? `ws://${location.hostname}:2567` : '');

const TOKEN_KEY = 'cinecards.reconnect';
export const savedReconnect = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const saveToken = (t: string | null) => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

