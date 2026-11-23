import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getHandView, HAND_VIEW_FR, HAND_VIEWS, setHandView, subscribeHandView } from '../game/handView.ts';
import { SPEED_FR, SPEEDS, type AnimSpeed } from '../game/playback.ts';
import { Icon } from './Icon.tsx';

const SPEED_SHORT: Record<AnimSpeed, string> = {
  normal: '×1',
  fast: '×2',
  instant: '⏭',
};

const PANEL_W = 250;

/**
 * "Réglages" button of the table's top bar (story 14.4, mockup `docs/design/mobile-table-v2/F-reglages`): a small
 * popover under the top bar with "Main ouverte : Compacte | Détaillée". The choice is kept on the device
 * (`game/handView.ts`); an open hand switches view at once. On desktop, tablet and landscape the hand is never
 * folded, so the setting changes nothing there. Closed by a tap outside (or on the gear again) and by Escape.
 * `speed`: on the phone table of an online duel the top bar has no room for the speed button, so the animation
 * speed is chosen here instead.
 */
export function SettingsButton({ speed }: { speed?: { value: AnimSpeed; set: (v: AnimSpeed) => void } }) {
  const [open, setOpen] = useState(false);
  const view = useSyncExternalStore(subscribeHandView, getHandView);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({});

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const w = Math.min(PANEL_W, innerWidth - 16);
      const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
      setPos({ left, width: w, top: r.bottom });
    };
    place();
    // the chosen option takes the focus; Escape gives it back to the gear
    panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    addEventListener('resize', place);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(true);
    };
    addEventListener('keydown', esc, true);
    return () => {
      removeEventListener('resize', place);
      removeEventListener('keydown', esc, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="icon-btn settings-btn"
        onClick={() => setOpen(!open)}
        aria-label="Réglages"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Réglages"
      >
        <Icon name="gear" size={16} />
      </button>
      {open
        ? createPortal(
            <>
              {/* swallows the outside tap (it must not play a card); a tap on the gear lands here too and closes */}
              <div className="settings-backdrop" onClick={() => close(false)} />
              <div ref={panel} className="settings-panel" role="dialog" aria-label="Réglages" style={pos}>
                <span className="settings-title">Réglages</span>
                <div className="settings-field">
                  <span className="settings-label" id="settings-hand-view">
                    Main ouverte
                  </span>
                  <div className="seg2" role="group" aria-labelledby="settings-hand-view">
                    {HAND_VIEWS.map((v) => (
                      <button key={v} type="button" aria-pressed={view === v} onClick={() => setHandView(v)}>
                        {HAND_VIEW_FR[v]}
                      </button>
                    ))}
                  </div>
                  <span className="settings-help">
                    Compacte : les cartes seules. Détaillée : la carte entière (type et effet de chaque capacité). Retenu sur cet appareil.
                  </span>
                </div>
                {speed ? (
                  <div className="settings-field">
                    <span className="settings-label" id="settings-speed">
                      Vitesse des animations
                    </span>
                    <div className="seg2" role="group" aria-labelledby="settings-speed">
                      {SPEEDS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={speed.value === v}
                          aria-label={`Vitesse ${SPEED_FR[v]}`}
                          title={`Vitesse ${SPEED_FR[v]}`}
                          onClick={() => speed.set(v)}
                        >
                          {SPEED_SHORT[v]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
