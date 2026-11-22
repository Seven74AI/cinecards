import { useEffect, useRef } from 'react';
import { fpsStats } from '../game/perf.ts';

/**
 * Story 13.12: with `?fps` in the address, a small counter in a corner: average and lowest frame rate over the
 * last second, so Root can measure on his iPhone. It writes its text itself (no React render per frame).
 */
export function FpsMeter() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let since = 0;
    let frames: number[] = [];
    const tick = (t: number) => {
      if (last) frames.push(t - last);
      else since = t;
      last = t;
      if (t - since >= 1000) {
        const { avg, min } = fpsStats(frames);
        if (ref.current) {
          ref.current.textContent = `${avg} i/s · min ${min}`;
          ref.current.classList.toggle('low', avg < 50 || min < 20);
        }
        frames = [];
        since = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} className="fps-meter" aria-hidden="true">
      … i/s
    </div>
  );
}
