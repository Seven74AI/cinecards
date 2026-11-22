import type { Card } from '@cinecards/cards';
import type { ComputedStats, Status } from '@cinecards/engine';
import { cardArt } from '../game/catalog.ts';
import { Icon, STATUS_ICON } from './Icon.tsx';

export const RARITY_CLASS: Record<string, string> = { common: 'r-common', rare: 'r-rare', epic: 'r-epic', legendary: 'r-legend', spell: 'r-spell', terrain: 'r-terrain' };
export const RARITY_FR: Record<string, string> = { common: 'Commune', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire', spell: 'Sort', terrain: 'Terrain' };

export interface CardViewProps {
  card: Card;
  stats?: ComputedStats | null;
  statuses?: Status[];
  sick?: boolean;
  cycle?: number | null;
  size?: 'board' | 'hand' | 'big';
  state?: 'selected' | 'target' | 'ready' | 'disabled' | 'attacker' | null;
  onClick?: () => void;
  iid?: string;
  fx?: { id: number; text: string; kind: string }[];
  cost?: number;
}

function statClass(cur: number, base: number) {
  return cur > base ? ' up' : cur < base ? ' down' : '';
}

export function CardView({ card, stats, statuses = [], sick, cycle, size = 'board', state, onClick, iid, fx, cost }: CardViewProps) {
  const art = cardArt(card);
  const isChar = card.category === 'character';
  const multi = stats?.bodies;
  const cls = ['card', `card-${size}`, RARITY_CLASS[card.rarity] ?? '', state ? `is-${state}` : '', card.rarity === 'legendary' ? 'shine' : ''].join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} data-iid={iid} aria-label={card.name}>
      <span className="card-frame">
        <span className="card-name">{card.name}</span>
        <span className="card-art">{art ? <img src={art} alt="" draggable={false} /> : null}</span>
        <span className="card-foot">
          <span className="gem" />
        </span>
      </span>
      <span className="coin card-cost">{cost ?? card.cost ?? 0}</span>
      {isChar && stats ? (
        <span className="card-stats">
          <span className={'badge atk' + statClass(stats.atk, stats.baseAtk)}>
            <Icon name="sword" size={10} />
            {multi ? multi.filter((b) => b.alive).map((b) => b.atk).join('·') : stats.atk}
          </span>
          <span className={'badge hp' + (stats.hp < stats.maxHp ? ' down' : statClass(stats.maxHp, stats.baseHp))}>
            <Icon name="heart" size={10} />
            {multi ? `${multi.filter((b) => b.alive).length}/${multi.length}` : stats.hp}
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
          <span className={'st cycle' + (cycle === 0 ? ' on' : '')} title={cycle === 0 ? 'Cycle actif ce tour' : `Cycle dans ${cycle} tour(s)`}>
            <Icon name="cycle" size={10} color={cycle === 0 ? '#4FD1C5' : '#F2D27A'} />
            {cycle > 0 ? <small>{cycle}</small> : null}
          </span>
        ) : null}
      </span>
      {fx?.map((f) => (
        <span key={f.id} className={`fx fx-${f.kind}`}>
          {f.text}
        </span>
      ))}
    </button>
  );
}

/** Face-down card (opponent hand, deck). */
export function CardBack({ small }: { small?: boolean }) {
  return <span className={'card-back' + (small ? ' small' : '')} aria-hidden="true" />;
}
