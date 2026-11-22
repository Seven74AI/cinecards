import type { Card } from '@cinecards/cards';
import { canUseAbility, computeStats, cycleCountdown, type Catalog, type GameState, type PlayerId } from '@cinecards/engine';
import { cardArt, SET_TITLES } from '../game/catalog.ts';
import { modifierLines, signed, type ModifierLine } from '../game/modifiers.ts';
import { atkDoublingEvery, CardView, CATEGORY_FR, CategoryTag, cycleTitle, RARITY_FR } from './CardView.tsx';
import { AbilityText, useRefs } from './Refs.tsx';
import { Icon, STATUS_ICON } from './Icon.tsx';

export interface SheetAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}

/** Splits "… : A OU B" style texts into two short labels for chooseOne abilities. */
export function choiceLabels(text: string): [string, string] {
  const parts = text.split(/\s+(?:OU|ou)\s+|\s*\/\s*/);
  if (parts.length >= 2) return [parts[0]!.replace(/^.*?:\s*/, '').slice(0, 60), parts[1]!.slice(0, 60)];
  return ['Choix 1', 'Choix 2'];
}

export function hasChooseOne(card: Card, index: number): boolean {
  return (card.abilities[index]?.effects ?? []).some((e) => e.op === 'chooseOne');
}

export function CardSheet({
  catalog,
  state,
  iid,
  viewer,
  actions,
  onUseAbility,
  onClose,
  docked,
}: {
  catalog: Catalog;
  state: GameState;
  iid: string;
  viewer: PlayerId;
  actions: SheetAction[];
  onUseAbility: (index: number, option?: number) => void;
  onClose: () => void;
  docked?: boolean;
}) {
  const inst = state.instances[iid];
  if (!inst) return null;
  const card = catalog.get(inst.cardId)!;
  const P = state.players[inst.owner];
  const onBoard = P.characters.includes(iid) || P.terrains.includes(iid) || P.spells.includes(iid);
  const stats = card.category === 'character' && onBoard ? computeStats(catalog, state, iid) : null;
  const cycle = onBoard ? cycleCountdown(catalog, state, iid) : null;
  const mine = inst.owner === viewer;
  const myTurn = state.active === viewer && !state.pending && state.phase !== 'finished';
  const mods = stats ? modifierLines(catalog, state, iid, stats.sources) : [];
  return (
    <aside className={'sheet' + (docked ? ' docked' : '')} role="dialog" aria-label={card.name}>
      {!docked ? <button type="button" className="sheet-scrim" aria-label="Fermer" onClick={onClose} /> : null}
      <div className="sheet-body parchment">
        <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Fermer">
          <Icon name="close" size={18} />
        </button>
        <div className="sheet-head">
          <CardView card={card} stats={stats} statuses={inst.statuses} size="big" cycle={cycle} />
          <div className="sheet-meta">
            <h2>{card.name}</h2>
            <p className="muted">
              {CATEGORY_FR[card.category] ?? card.category} · {RARITY_FR[card.rarity] ?? card.rarity} · {card.role} · {SET_TITLES[card.set] ?? card.set}
            </p>
            {stats ? (
              <p className="sheet-stats">
                <span>
                  <Icon name="sword" size={13} /> {stats.atk} <small>(base {stats.baseAtk})</small>
                </span>
                <span>
                  <Icon name="heart" size={13} /> {stats.hp}/{stats.maxHp} <small>(base {stats.baseHp})</small>
                </span>
              </p>
            ) : null}
            {stats && cycle != null && atkDoublingEvery(card) ? (
              <p className="sheet-cycle">
                <Icon name="cycle" size={12} color={cycle === 0 ? '#4FD1C5' : '#F2D27A'} /> {cycleTitle(card, cycle)}
                {cycle > 0 ? ` (${stats.atk} → ${stats.atk * 2})` : ''}
              </p>
            ) : null}
            {inst.statuses.length ? (
              <p className="sheet-statuses">
                {inst.statuses.map((s, i) => (
                  <span key={i} className="chip">
                    <Icon name={STATUS_ICON[s.kind]?.icon ?? 'star'} size={12} color={STATUS_ICON[s.kind]?.color} /> {STATUS_ICON[s.kind]?.label ?? s.kind}
                    {s.amount ? ` ${s.amount}` : ''}
                    {s.turnsLeft ? ` · ${s.turnsLeft} t.` : ''}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        </div>
        {mods.length ? <Modifiers catalog={catalog} lines={mods} /> : null}
        <ol className="abilities">
          {card.abilities.map((ab, index) => {
            const usable = mine && onBoard && myTurn && card.category === 'character' && (ab.kind === 'active' || ab.kind === 'attack' || ab.kind === 'choice');
            const why = usable ? canUseAbility(catalog, state, viewer, iid, index) : null;
            const choose = hasChooseOne(card, index);
            const labels = choose ? choiceLabels(ab.text) : null;
            return (
              <li key={index} className={'ability k-' + ab.kind}>
                <div className="ability-head">
                  {ab.power ? (
                    <span className={'power p-' + ab.power.icon}>
                      <Icon name={ab.power.icon} size={11} />
                      {ab.power.count > 1 ? <small>×{ab.power.count}</small> : null}
                    </span>
                  ) : null}
                  <strong>{ab.name}</strong>
                </div>
                <p>
                  <AbilityText card={card} ability={ab} />
                </p>
                {usable ? (
                  <div className="ability-actions">
                    {labels ? (
                      labels.map((l, o) => (
                        <button key={o} type="button" className="btn small" disabled={!!why} onClick={() => onUseAbility(index, o)}>
                          {l}
                        </button>
                      ))
                    ) : (
                      <button type="button" className="btn small" disabled={!!why} onClick={() => onUseAbility(index)}>
                        {why
                          ? why.code === 'ABILITY_USED'
                            ? 'Déjà utilisée'
                            : why.code === 'SILENCED'
                              ? 'Silence'
                              : why.code === 'NO_ATTACK_LEFT'
                                ? 'Attaque déjà faite'
                                : why.code === 'SUMMONING_SICK'
                                  ? 'Au prochain tour'
                                  : 'Indisponible'
                          : ab.kind === 'attack'
                            ? 'Utiliser (au lieu d’attaquer)'
                            : 'Utiliser'}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        {'flavor' in card && card.flavor ? <p className="flavor">« {String(card.flavor)} »</p> : null}
        {actions.length ? (
          <div className="sheet-actions">
            {actions.map((a) => (
              <button key={a.label} type="button" className={'btn' + (a.primary ? ' primary' : '')} disabled={a.disabled} onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/**
 * Story 13.3: each bonus or penalty with its source card (thumbnail, name), the ability, the value and how long
 * it lasts. A tap opens the source's preview (story 13.1); a source no longer on the table is "carte partie".
 */
function Modifiers({ catalog, lines }: { catalog: Catalog; lines: ModifierLine[] }) {
  const { previewCard } = useRefs();
  return (
    <section className="mods" aria-label="Bonus et malus">
      <h3>Bonus et malus</h3>
      <ul>
        {lines.map((l, i) => {
          const src = l.cardId ? catalog.get(l.cardId) : undefined;
          const art = src ? cardArt(src) : undefined;
          const body = (
            <>
              <span className="mod-thumb" aria-hidden="true">
                {art ? <img src={art} alt="" draggable={false} /> : <Icon name="star" size={14} />}
              </span>
              <span className="mod-txt">
                {src ? <CategoryTag category={src.category} /> : null}
                <b>{src ? (l.self ? `${src.name} (elle-même)` : src.name) : l.label}</b>
                {src ? <small>« {l.label} »</small> : null}
              </span>
              <span className="mod-val">
                {l.atk ? <span className={l.atk > 0 ? 'up' : 'down'}>{signed(l.atk, 'ATQ')}</span> : null}
                {l.hp ? <span className={l.hp > 0 ? 'up' : 'down'}>{signed(l.hp, 'PV')}</span> : null}
              </span>
              <span className="mod-dur">
                {src && !l.inPlay ? <em className="gone">carte partie</em> : null}
                {l.duration}
              </span>
            </>
          );
          return (
            <li key={i}>
              {src ? (
                <button type="button" className={'mod-src ' + l.tone} onClick={() => previewCard(src.id, l.ability)} aria-label={`${src.name} (${CATEGORY_FR[src.category] ?? src.category}) : ${l.label}`}>
                  {body}
                </button>
              ) : (
                <span className={'mod-src ' + l.tone}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
