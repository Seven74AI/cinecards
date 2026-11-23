import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { EMOTE_COOLDOWN_MS, EMOTE_IDS, EMOTES, type EmoteId, type PlayerId } from '@cinecards/protocol';
import type { Snapshot } from '../game/session.ts';
import { Icon } from './Icon.tsx';

/** How long a bubble stays on screen (story 8.5). */
export const BUBBLE_MS = 3000;
const MUTE_KEY = 'cinecards.muteEmotes';

// ---- small shared stores: the mute switch (kept on the device) and the send cooldown ----

function tinyStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(v: T) {
      value = v;
      for (const l of listeners) l();
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const readMute = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};
const muteStore = tinyStore(readMute());
export const emotesMuted = () => muteStore.get();
export function setEmotesMuted(on: boolean) {
  try {
    if (on) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // private mode: the switch still works for this page
  }
  muteStore.set(on);
}

const coolStore = tinyStore(false);
let coolTimer: ReturnType<typeof setTimeout> | null = null;
function startCooldown() {
  coolStore.set(true);
  if (coolTimer) clearTimeout(coolTimer);
  coolTimer = setTimeout(() => {
    coolTimer = null;
    coolStore.set(false);
  }, EMOTE_COOLDOWN_MS);
}

const PICKER_W = 300;

/**
 * "Répliques" button (story 8.5): opens the list of the 8 emotes and the mute switch.
 * Only rendered for online sessions (those that provide `sendEmote`).
 */
export function EmoteButton({ send, className = 'icon-btn' }: { send: (id: EmoteId) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const cooling = useSyncExternalStore(coolStore.subscribe, coolStore.get);
  const muted = useSyncExternalStore(muteStore.subscribe, muteStore.get);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const w = Math.min(PICKER_W, innerWidth - 16);
      const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
      setPos(r.top > innerHeight / 2 ? { left, width: w, bottom: innerHeight - r.top + 6 } : { left, width: w, top: r.bottom + 6 });
    };
    place();
    addEventListener('resize', place);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('resize', place);
      removeEventListener('keydown', esc);
    };
  }, [open]);

  const pick = (id: EmoteId) => {
    if (coolStore.get()) return;
    send(id);
    startCooldown();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className + ' emote-btn' + (cooling ? ' cooling' : '')}
        onClick={() => setOpen(!open)}
        aria-label="Répliques"
        aria-expanded={open}
        title={cooling ? 'Répliques (patiente un instant)' : 'Répliques'}
      >
        <Icon name="chat" size={16} />
      </button>
      {open
        ? createPortal(
            <>
              <div className="emote-backdrop" onClick={() => setOpen(false)} />
              <div className="emote-picker parchment-dark" role="dialog" aria-label="Répliques" style={pos}>
                <div className="emote-grid">
                  {EMOTE_IDS.map((id) => (
                    <button key={id} type="button" className="emote-choice" disabled={cooling} onClick={() => pick(id)}>
                      {EMOTES[id]}
                    </button>
                  ))}
                </div>
                <label className="emote-mute">
                  <input type="checkbox" role="switch" checked={muted} onChange={(e) => setEmotesMuted(e.target.checked)} />
                  <span className="emote-switch" aria-hidden="true" />
                  Couper les répliques adverses
                </label>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

type Shown = { id: EmoteId; at: number; leaving: boolean } | null;

/**
 * Speech bubbles near the portraits (story 8.5): 3 s, a new one replaces the previous one, taps go through.
 * `dim`: a target is being chosen, so the bubbles fade back and never hide the choice.
 */
export function EmoteBubbles({ last, me, dim }: { last: Snapshot['lastEmote']; me: PlayerId; dim: boolean }) {
  const [shown, setShown] = useState<[Shown, Shown]>([null, null]);
  const muted = useSyncExternalStore(muteStore.subscribe, muteStore.get);
  const [, setTick] = useState(0);

  // timers per seat: a new bubble from one player must not cancel the other player's
  const timers = useRef<[ReturnType<typeof setTimeout>[], ReturnType<typeof setTimeout>[]]>([[], []]);
  useEffect(() => {
    if (!last || Date.now() - last.at > BUBBLE_MS) return;
    if (last.from !== me && muteStore.get()) return;
    const from = last.from;
    const mine = { id: last.id, at: last.at, leaving: false };
    setShown((s) => patch(s, from, mine));
    const left = BUBBLE_MS - (Date.now() - last.at);
    for (const t of timers.current[from]) clearTimeout(t);
    timers.current[from] = [
      setTimeout(() => setShown((s) => (s[from]?.at === mine.at ? patch(s, from, { ...mine, leaving: true }) : s)), Math.max(0, left - 250)),
      setTimeout(() => setShown((s) => (s[from]?.at === mine.at ? patch(s, from, null) : s)), left),
    ];
  }, [last, me]);
  useEffect(() => () => timers.current.flat().forEach(clearTimeout), []);

  // muting hides the opponent's bubble at once
  useEffect(() => {
    if (muted) setShown((s) => patch(s, me === 0 ? 1 : 0, null));
  }, [muted, me]);

  useEffect(() => {
    const re = () => setTick((n) => n + 1);
    addEventListener('resize', re);
    return () => removeEventListener('resize', re);
  }, []);

  if (!shown[0] && !shown[1]) return null;
  return createPortal(
    <div className={'emote-layer' + (dim ? ' dim' : '')} aria-live="polite">
      {([0, 1] as PlayerId[]).map((p) => {
        const b = shown[p];
        if (!b) return null;
        const hero = document.querySelector<HTMLElement>(`.table [data-hero="${p}"]`);
        const r = hero?.getBoundingClientRect();
        if (!r) return null;
        const below = r.top + r.height / 2 < innerHeight / 2;
        const left = Math.max(6, r.left + 4);
        const style: React.CSSProperties = below ? { top: r.bottom + 6, left, maxWidth: innerWidth - left - 6 } : { bottom: innerHeight - r.top + 6, left, maxWidth: innerWidth - left - 6 };
        return (
          <div key={p + ':' + b.at} data-emote-from={p} className={'emote-bubble ' + (below ? 'below' : 'above') + (p === me ? ' mine' : ' theirs') + (b.leaving ? ' leaving' : '')} style={style}>
            {EMOTES[b.id]}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

const patch = (s: [Shown, Shown], p: PlayerId, v: Shown): [Shown, Shown] => (p === 0 ? [v, s[1]] : [s[0], v]);
