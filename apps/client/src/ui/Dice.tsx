import { useEffect, useRef, useState } from 'react';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

/** Animated die (story 7.5): tumbles through faces, then lands on the engine's value. */
export function Dice({ value, label, onDone }: { value: number; label: string; onDone: () => void }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [face, setFace] = useState(reduce ? value : 1);
  const [landed, setLanded] = useState(reduce);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const onDone = () => done.current();
    if (reduce) {
      const t = setTimeout(onDone, 1000);
      return () => clearTimeout(t);
    }
    let n = 0;
    const roll = setInterval(() => {
      n++;
      setFace(((n * 5) % 6) + 1);
      if (n >= 9) {
        clearInterval(roll);
        setFace(value);
        setLanded(true);
      }
    }, 80);
    const end = setTimeout(onDone, 1500);
    return () => {
      clearInterval(roll);
      clearTimeout(end);
    };
  }, [value, reduce]);
  return (
    <div className="overlay dice-overlay" onClick={onDone}>
      <div className={'die' + (landed ? ' landed' : ' rolling')} aria-label={`Dé : ${value}`}>
        <svg viewBox="0 0 100 100" width="96" height="96">
          <rect x="4" y="4" width="92" height="92" rx="18" />
          {PIPS[face]!.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="8" />
          ))}
        </svg>
      </div>
      <div className="dice-label">{label}</div>
    </div>
  );
}
