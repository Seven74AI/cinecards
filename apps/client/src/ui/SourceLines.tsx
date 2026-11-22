import { useEffect, useState } from 'react';

export interface SourceLink {
  source: string;
  tone: 'buff' | 'malus';
}
type Seg = { x1: number; y1: number; x2: number; y2: number; tone: SourceLink['tone']; key: string };

/** Centre of a card on the table (characters, terrains, spells), or null when it is not shown. */
function centre(iid: string): { x: number; y: number } | null {
  const sel = `.board [data-iid="${CSS.escape(iid)}"], .zones [data-iid="${CSS.escape(iid)}"]`;
  const r = document.querySelector(sel)?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

const same = (a: Seg[], b: Seg[]) => a.length === b.length && a.every((s, i) => s.key === b[i]!.key && s.x1 === b[i]!.x1 && s.y1 === b[i]!.y1 && s.x2 === b[i]!.x2 && s.y2 === b[i]!.y2);

/**
 * Story 13.3: a glowing line from each source on the table to the selected card, green for a bonus and red for
 * a penalty. Positions follow the cards every frame (the presentation layer moves them), never catch a tap.
 */
export function SourceLines({ target, links }: { target: string; links: SourceLink[] }) {
  const [segs, setSegs] = useState<Seg[]>([]);
  const linksKey = links.map((l) => l.source + l.tone).join('|');
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = centre(target);
      const next: Seg[] = [];
      if (t)
        for (const l of links) {
          const s = centre(l.source);
          if (s) next.push({ x1: Math.round(s.x), y1: Math.round(s.y), x2: Math.round(t.x), y2: Math.round(t.y), tone: l.tone, key: l.source + l.tone });
        }
      setSegs((prev) => (same(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target, linksKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!segs.length) return null;
  return (
    <svg className="src-lines" aria-hidden="true" data-count={segs.length}>
      {segs.map((s) => (
        <g key={s.key} className={'src-line ' + s.tone}>
          <line className="glow" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          <line className="flow" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          <circle cx={s.x1} cy={s.y1} r="7" />
        </g>
      ))}
    </svg>
  );
}
