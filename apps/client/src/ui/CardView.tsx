import type { CSSProperties } from 'react';
import type { Card } from '@cinecards/cards';
import type { ComputedStats, Status } from '@cinecards/engine';
import { cardArt } from '../game/catalog.ts';
import { Icon, STATUS_ICON } from './Icon.tsx';
import { Counter } from './Counter.tsx';
import { sourceCounts } from '../game/modifiers.ts';

export { abilityBody, abilityTag } from '../game/labels.ts';

/** Rarity → frame class (story 11.7: every category has a rarity). */
export const RARITY_CLASS: Record<string, string> = { common: 'r-common', rare: 'r-rare', epic: 'r-epic', legendary: 'r-legend' };
export const RARITY_FR: Record<string, string> = { common: 'Commune', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire' };
const RARITY_LEVEL: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
export const CATEGORY_FR: Record<string, string> = { character: 'Personnage', spell: 'Sort', equipment: 'Équipement', terrain: 'Terrain' };

/** Category → cost token shape and icon (mockup D): shield + sword, wax seal + bolt, steel hex nut + gear, green diamond + mountain. */
const CATEGORY_TOKEN: Record<string, { cls: string; shape: string; icon: string }> = {
  character: { cls: 'cat-char', shape: 'tok-shield', icon: '<path d="M5 19L17 7"/><path d="M14 5l5 5"/>' },
  spell: { cls: 'cat-spell', shape: 'tok-seal', icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>' },
  equipment: { cls: 'cat-equip', shape: 'tok-hex', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>' },
  terrain: { cls: 'cat-terr', shape: 'tok-dia', icon: '<path d="M2 20l7-11 4 6 3-4 6 9z"/>' },
};

/** Token outlines in a 24 × 26 box, same shapes as the cost token's clip-paths. */
const TAG_SHAPE: Record<string, { d: string; fill: string; stroke: string }> = {
  character: { d: 'M1 1H23V16L12 25L1 16Z', fill: '#c9962e', stroke: '#3a2608' },
  spell: { d: 'M12 1.5A11.5 11.5 0 1 1 11.99 1.5Z', fill: '#a3271f', stroke: '#fff' },
  equipment: { d: 'M6.5 2H17.5L23.5 13L17.5 24H6.5L0.5 13Z', fill: '#4a5662', stroke: '#fff' },
  terrain: { d: 'M12 0.5L23.5 13L12 25.5L0.5 13Z', fill: '#3e7a1c', stroke: '#fff' },
};

/** Story 13.5: the category of a card as its cost-token shape and icon, plus its French name. */
export function CategoryTag({ category }: { category: string }) {
  const tok = CATEGORY_TOKEN[category] ?? CATEGORY_TOKEN.character!;
  const shape = TAG_SHAPE[category] ?? TAG_SHAPE.character!;
  return (
    <span className={`cat-tag ${tok.cls}`}>
      <svg viewBox="0 0 24 26" width="15" height="16" aria-hidden="true">
        <path d={shape.d} fill={shape.fill} stroke="#8a6416" strokeWidth="1.2" />
        <g transform="translate(5.5 5) scale(0.55)" fill="none" stroke={shape.stroke} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: tok.icon }} />
      </svg>
      {CATEGORY_FR[category] ?? category}
    </span>
  );
}

/** Rarity ornaments drawn in SVG (mockup F): corner brackets (rare), fleurons (epic+), filigree and sheen (legendary). */
function Ornaments({ level }: { level: number }) {
  if (level === 0) return null;
  const corners = ['tr', 'bl', 'br'] as const;
  return (
    <span className="orns" aria-hidden="true">
      {level === 1
        ? corners.map((c) => (
            <svg key={c} className={`orn-corner c-${c}`} viewBox="0 0 16 16">
              <path d="M2 2h12v12" fill="none" stroke="#8a6416" strokeWidth="1.8" />
            </svg>
          ))
        : corners.map((c) => (
            <svg key={c} className={`orn-fleur c-${c}`} viewBox="0 0 20 20">
              <path d="M19 1H8c2 1 3 3 3 5M19 1v11c-1-2-3-3-5-3" fill="none" stroke="#8a6416" strokeWidth="1.6" />
              <circle cx="15" cy="5" r="2" fill={level === 3 ? '#ff9500' : '#b020c0'} />
            </svg>
          ))}
      {level === 3 ? (
        <>
          <span className="orn-fil" />
          <span className="orn-fil2" />
          <span className="orn-sheen" />
        </>
      ) : null}
    </span>
  );
}

const LAUREL = [
  [12, 44, -35],
  [8, 33, -10],
  [10, 22, 20],
  [18, 13, 50],
  [56, 44, 35],
  [60, 33, 10],
  [58, 22, -20],
  [50, 13, -50],
] as const;

function Laurel({ glow = false }: { glow?: boolean }) {
  return (
    <svg className={'tok-laurel' + (glow ? ' glow' : '')} viewBox="0 0 68 68" aria-hidden="true">
      <g fill="#f2d27a" stroke="#8a6416" strokeWidth=".6">
        {LAUREL.map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="3" ry="6.5" transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}

/** Cost token: its shape and icon give the category; ring, set gem and laurel grow with the rarity. */
export function CostToken({ card, cost }: { card: Pick<Card, 'category' | 'rarity'>; cost: number }) {
  const tok = CATEGORY_TOKEN[card.category] ?? CATEGORY_TOKEN.character!;
  const lv = RARITY_LEVEL[card.rarity] ?? 0;
  return (
    <span className={`card-token ${tok.shape}`} title={CATEGORY_FR[card.category]}>
      {lv === 3 ? (
        <>
          <Laurel />
          {/* story 13.12: the same laurel with its strong glow drawn once; only its opacity pulses */}
          <Laurel glow />
        </>
      ) : null}
      {lv >= 1 ? (
        <span className="tok-ring">
          <span className="tok-ri" />
        </span>
      ) : null}
      <span className="tok-o" />
      <span className="tok-i">
        <b>{cost}</b>
        <svg className="tok-ico" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: tok.icon }} />
      </span>
      {lv >= 2 ? <span className={'tok-set' + (lv === 3 ? ' leg' : '')} /> : null}
    </span>
  );
}

export interface CardViewProps {
  card: Card;
  stats?: ComputedStats | null;
  statuses?: Status[];
  sick?: boolean;
  cycle?: number | null;
  size?: 'board' | 'hand' | 'big';
  state?: 'selected' | 'target' | 'ready' | 'disabled' | 'attacker' | null;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  iid?: string;
  /** Milliseconds for the HP badge to roll to a new value (story 12.3). */
  count?: number;
  cost?: number;
  /** Destroyed, still shown for its death animation (story 12.1). */
  dying?: boolean;
  /** Sent back to hand, still shown while it flies off (story 12.4). */
  leaving?: boolean;
  style?: CSSProperties;
}

function statClass(cur: number, base: number) {
  return cur > base ? ' up' : cur < base ? ' down' : '';
}

/** Story 13.4: the cycle period of a "your ATQ doubles every N turns" card (Néo), or null. */
export function atkDoublingEvery(card: Card): number | null {
  for (const ab of card.abilities) for (const e of ab.effects ?? []) if (e.op === 'cycleAtkDouble') return Number((e as { every?: number }).every ?? 2);
  return null;
}

/** What the cycle badge announces: the next ATQ doubling for Néo, the generic cycle otherwise. */
export function cycleTitle(card: Card, cycle: number): string {
  const every = atkDoublingEvery(card);
  if (every) return cycle === 0 ? `ATQ doublée ce tour · prochain doublement dans ${every} tours` : `ATQ doublée dans ${cycle} tour${cycle > 1 ? 's' : ''}`;
  return cycle === 0 ? 'Cycle actif ce tour' : `Cycle dans ${cycle} tour(s)`;
}

export function CardView({ card, stats, statuses = [], sick, cycle, size = 'board', state, onClick, iid, count = 0, cost, dying, leaving, style }: CardViewProps) {
  const art = cardArt(card);
  const isChar = card.category === 'character';
  const multi = stats?.bodies;
  // story 13.3: on the table, a modified badge shows how many sources change it
  const srcN = size === 'board' ? sourceCounts(stats?.sources) : { atk: 0, hp: 0 };
  const cls = ['card', `card-${size}`, CATEGORY_TOKEN[card.category]?.cls ?? '', RARITY_CLASS[card.rarity] ?? '', state ? `is-${state}` : '', dying ? 'is-dying' : '', leaving ? 'is-leaving' : '', statuses.some((s) => s.kind === 'silence') ? 'is-silenced' : ''].join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} data-iid={iid} aria-label={card.name} style={style}>
      <span className="card-frame">
        <span className="card-name">{card.name}</span>
        <span className="card-art">{art ? <img src={art} alt="" draggable={false} /> : null}</span>
        <span className="card-foot">
          <span className="gem" />
        </span>
        <Ornaments level={RARITY_LEVEL[card.rarity] ?? 0} />
      </span>
      <CostToken card={card} cost={cost ?? card.cost ?? 0} />
      {isChar && stats ? (
        <span className="card-stats">
          <span className={'badge atk' + statClass(stats.atk, stats.baseAtk) + (srcN.atk ? ' has-src' : '')} data-stat={srcN.atk ? 'atk' : undefined}>
            <Icon name="sword" size={10} />
            {multi ? multi.filter((b) => b.alive).map((b) => b.atk).join('·') : stats.atk}
            {srcN.atk ? <i className="src-n" title={`${srcN.atk} source(s)`}>{srcN.atk}</i> : null}
          </span>
          <span className={'badge hp' + (stats.hp < stats.maxHp ? ' down' : statClass(stats.maxHp, stats.baseHp)) + (srcN.hp ? ' has-src' : '')} data-stat={srcN.hp ? 'hp' : undefined}>
            <Icon name="heart" size={10} />
            {multi ? `${multi.filter((b) => b.alive).length}/${multi.length}` : <Counter value={stats.hp} ms={count} />}
            {srcN.hp ? <i className="src-n" title={`${srcN.hp} source(s)`}>{srcN.hp}</i> : null}
          </span>
        </span>
      ) : null}
      {isChar && !stats && size !== 'board' ? (
        <span className="card-stats">
          <span className="badge atk">
            <Icon name="sword" size={10} />
            {Array.isArray(card.atk) ? card.atk.join('·') : card.atk}
          </span>
          <span className="badge hp">
            <Icon name="heart" size={10} />
            {Array.isArray(card.hp) ? card.hp.length + '×' + card.hp[0] : card.hp}
          </span>
        </span>
      ) : null}
      <span className="card-status">
        {sick ? (
          <span className="st" title="Attend un tour">
            <Icon name="hourglass" size={10} color="#F2D27A" />
          </span>
        ) : null}
        {statuses.map((s, i) => {
          const m = STATUS_ICON[s.kind];
          return m ? (
            <span key={i} className="st" title={m.label}>
              <Icon name={m.icon} size={10} color={m.color} />
            </span>
          ) : null;
        })}
        {cycle != null ? (
          <span className={'st cycle' + (cycle === 0 ? ' on' : '')} title={cycleTitle(card, cycle)} aria-label={cycleTitle(card, cycle)}>
            <Icon name="cycle" size={10} color={cycle === 0 ? '#4FD1C5' : '#F2D27A'} />
            {atkDoublingEvery(card) ? <i className="x2">×2</i> : null}
            {cycle > 0 ? <small>{cycle}</small> : null}
          </span>
        ) : null}
      </span>
      {dying ? (
        <>
          <span className="cracks" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CRACKS_SVG }} />
          <span className="scorch" aria-hidden="true" />
        </>
      ) : null}
      {statuses.some((s) => s.kind === 'silence') ? <Chains /> : null}
    </button>
  );
}

/** Face-down card (opponent hand, deck). */
export function CardBack({ small }: { small?: boolean }) {
  return <span className={'card-back' + (small ? ' small' : '')} aria-hidden="true" />;
}

/** Cracks of a dying card (story 12.4), faded in by the director. */
export const CRACKS_SVG =
  '<svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><path d="M48 0 L42 30 L58 52 L40 80 L55 104 L46 140 M58 52 L82 60 M40 80 L14 88" fill="none" stroke="#2a1a0e" stroke-width="2.6"/></svg>';

/** Chains crossed over a silenced card (story 12.3); also drawn, animated, when the silence lands. */
export const CHAINS_SVG =
  '<svg viewBox="0 0 60 84" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#cfd9e1" stroke-width="3" stroke-dasharray="7 3" stroke-linecap="round"><path d="M4 6L56 78"/><path d="M56 6L4 78"/></g><circle cx="30" cy="42" r="7" fill="#3a4450" stroke="#cfd9e1" stroke-width="2.5"/></svg>';

function Chains() {
  return <span className="chains" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHAINS_SVG }} />;
}
