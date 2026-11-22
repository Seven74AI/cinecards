import { useEffect, useRef } from 'react';

/**
 * A number that rolls from its previous value to the new one (story 12.3: "le compteur de PV défile").
 * Writes into React's own text node once per frame, so React does not re-render while it rolls.
 */
export function Counter({ value, ms }: { value: number; ms: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const pace = useRef(ms);
  pace.current = ms;
  useEffect(() => {
    const el = ref.current;
    const from = shown.current;
    const write = (v: number) => {
      shown.current = v;
      if (el?.firstChild) el.firstChild.nodeValue = String(v);
    };
    if (!el || from === value) return;
    const ms = pace.current;
    if (ms <= 0) return write(value);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      write(Math.round(from + (value - from) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      write(value);
    };
  }, [value]);
  return (
    <span ref={ref} className="counter">
      {shown.current}
    </span>
  );
}
