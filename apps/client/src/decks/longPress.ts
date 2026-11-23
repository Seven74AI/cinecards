import { useRef } from 'react';

export const LONG_PRESS_MS = 450;

/**
 * Tap or long press on a card (story 10.2): a press held LONG_PRESS_MS without moving calls `onLong`
 * (the card sheet) and swallows the click that follows; a right click does the same. Returns props for the
 * wrapper and a click guard for the button inside.
 */
export function useLongPress(onLong: (id: string) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  const bind = (id: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      cancel();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLong(id);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (fired.current) return; // the long press already opened it (touch screens also send contextmenu)
      cancel();
      onLong(id);
    },
  });
  /** True (once) when the click comes right after a long press: the tap must then do nothing. */
  const swallow = () => {
    const f = fired.current;
    fired.current = false;
    return f;
  };
  return { bind, swallow };
}
