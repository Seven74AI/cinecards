/**
 * Story 14.3: how my open hand shows on the portrait phone table. "compact" (story 14.2, the default): whole card
 * faces in a short panel; "detailed": full cards with their ability texts, the panel as tall as the tallest one.
 * Story 14.4 exposes the choice in the "Réglages" panel; it is kept on the device, like the animation speed and the
 * sound. On the dev server (and builds made with VITE_SCENES=1) `?handView=detailed` forces it for the tests.
 */
export type HandView = 'compact' | 'detailed';
export const HAND_VIEWS: readonly HandView[] = ['compact', 'detailed'];
export const HAND_VIEW_FR: Record<HandView, string> = { compact: 'Compacte', detailed: 'Détaillée' };
export const HAND_VIEW_KEY = 'cinecards.handView';
export const DEFAULT_HAND_VIEW: HandView = 'compact';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function parseHandView(v: string | null | undefined): HandView | null {
  return v === 'compact' || v === 'detailed' ? v : null;
}

/** `?handView=detailed` in an address (dev and test builds only, see `urlOverride`). */
export function handViewFromSearch(search: string): HandView | null {
  return parseHandView(new URLSearchParams(search).get('handView'));
}

const browserStore = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // storage blocked
  }
};

const urlOverride = (): HandView | null => {
  if (!import.meta.env.DEV && !import.meta.env.VITE_SCENES) return null;
  return typeof location === 'undefined' ? null : handViewFromSearch(location.search);
};

/** The saved choice; a forced one (`override`) wins; Compacte when nothing valid is saved. */
export function loadHandView(store: Store | null = browserStore(), override: HandView | null = urlOverride()): HandView {
  if (override) return override;
  try {
    return parseHandView(store?.getItem(HAND_VIEW_KEY)) ?? DEFAULT_HAND_VIEW;
  } catch {
    return DEFAULT_HAND_VIEW;
  }
}

let current: HandView | null = null;
const listeners = new Set<() => void>();

/** The view in use now (read once, then kept in memory). */
export function getHandView(): HandView {
  current ??= loadHandView();
  return current;
}

/** Changes the view, keeps it on the device and tells the open tables. */
export function setHandView(v: HandView, store: Store | null = browserStore()) {
  current = v;
  try {
    store?.setItem(HAND_VIEW_KEY, v);
  } catch {
    /* private mode: keep it for this session only */
  }
  listeners.forEach((l) => l());
}

/** For `useSyncExternalStore(subscribeHandView, getHandView)`. */
export function subscribeHandView(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
