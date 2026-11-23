import { useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@cinecards/cards';
import { DECK_SIZE, validateDeck } from '@cinecards/cards';
import { CATALOG, PLAYABLE, SET_FAMILIES } from '../game/catalog.ts';
import { createDeck, deleteDeck, updateDeck, type SavedDeck } from '../account/api.ts';
import type { SignedIn } from '../account/session.ts';
import { CardView, CATEGORY_FR, CostToken, RARITY_FR } from '../ui/CardView.tsx';
import { useRefs } from '../ui/Refs.tsx';
import {
  activeCount,
  CATEGORIES,
  COST_BAND_FR,
  COST_BANDS,
  copyName,
  costCurve,
  filmList,
  filterCards,
  NO_FILTERS,
  RARITIES,
  shortError,
  SORT_FR,
  sortCards,
  toggle,
  type DeckFilters,
  type SortKey,
} from './filters.ts';
import { CategoryToken, DeckIcon } from './icons.tsx';
import { useLongPress } from './longPress.ts';
import { ConfirmDialog, DeckStatus, useToast } from './parts.tsx';

/** Server limit of cards in a saved deck (more than DECK_SIZE so an over-full deck can still be saved). */
const MAX_CARDS = 60;
const CATEGORY_PLURAL: Record<string, string> = { character: 'Personnages', spell: 'Sorts', equipment: 'Équipements', terrain: 'Terrains' };
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

const POOL: Card[] = PLAYABLE.map((id) => CATALOG.get(id)).filter((c): c is Card => !!c);
const FILM_ORDER = filmList(POOL, SET_FAMILIES).map((f) => f.set);
const sameCards = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

type Dialog = 'leave' | 'delete' | null;

/**
 * Deck builder, option B "Grille unique" (story 10.2): a grid of real cards with a gold check on those in the deck,
 * tap = add or remove, long press = the card sheet; filters and the deck itself open in bottom sheets.
 */
export function DeckBuilder({ me, initial, onBack, onReplace }: { me: SignedIn; initial: SavedDeck | null; onBack: () => void; onReplace: (deck: SavedDeck) => void }) {
  const { openCard } = useRefs();
  const [saved, setSaved] = useState<{ id: number | null; name: string; cards: string[] }>(() => ({ id: initial?.id ?? null, name: initial?.name ?? 'Nouveau deck', cards: initial?.cards ?? [] }));
  const [name, setName] = useState(saved.name);
  const [cards, setCards] = useState<string[]>(saved.cards);
  const [filters, setFilters] = useState<DeckFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('cost');
  const [sheet, setSheet] = useState<'filters' | 'deck' | null>(null);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  const nameRef = useRef<HTMLInputElement>(null);

  const inDeck = useMemo(() => new Set(cards), [cards]);
  const shown = useMemo(() => filterCards(POOL, filters, inDeck, sort, FILM_ORDER), [filters, inDeck, sort]);
  const validation = useMemo(() => validateDeck(cards, CATALOG, PLAYABLE), [cards]);
  const dirty = name.trim() !== saved.name || !sameCards(cards, saved.cards);
  const nFilters = activeCount(filters);
  const press = useLongPress((id) => openCard(id));

  const flip = (id: string) => {
    if (inDeck.has(id)) setCards((cs) => cs.filter((c) => c !== id));
    else if (cards.length >= MAX_CARDS) show(`${MAX_CARDS} cartes au plus.`, true);
    else setCards((cs) => [...cs, id]);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const r = saved.id === null ? await createDeck(me.token, name, cards) : await updateDeck(me.token, saved.id, name, cards);
    setBusy(false);
    if (!r.ok) return show(r.message, true);
    const d = r.data.deck;
    setSaved({ id: d.id, name: d.name, cards: d.cards });
    setName(d.name);
    setCards(d.cards);
    show(d.valid ? 'Deck enregistré · valide' : 'Deck enregistré');
  };

  const copy = async () => {
    setMenu(false);
    if (busy) return;
    setBusy(true);
    const r = await createDeck(me.token, copyName(name.trim() || 'Nouveau deck'), cards);
    setBusy(false);
    if (!r.ok) return show(r.message, true);
    onReplace(r.data.deck);
  };

  const remove = async () => {
    setDialog(null);
    if (saved.id === null) return onBack();
    setBusy(true);
    const r = await deleteDeck(me.token, saved.id);
    setBusy(false);
    if (!r.ok && r.status !== 404) return show(r.message, true);
    onBack();
  };

  const back = () => (dirty ? setDialog('leave') : onBack());

  const filterChips: { key: string; label: string; clear: () => void }[] = [
    ...filters.sets.map((s) => ({ key: `s:${s}`, label: `Film : ${SET_FAMILIES[s] ?? s}`, clear: () => setFilters((f) => ({ ...f, sets: toggle(f.sets, s) })) })),
    ...filters.categories.map((c) => ({ key: `c:${c}`, label: CATEGORY_FR[c] ?? c, clear: () => setFilters((f) => ({ ...f, categories: toggle(f.categories, c) })) })),
    ...filters.rarities.map((r) => ({ key: `r:${r}`, label: RARITY_FR[r] ?? r, clear: () => setFilters((f) => ({ ...f, rarities: toggle(f.rarities, r) })) })),
    ...filters.costs.map((c) => ({ key: `k:${c}`, label: `Coût ${COST_BAND_FR[c]}`, clear: () => setFilters((f) => ({ ...f, costs: toggle(f.costs, c) })) })),
    ...(filters.hideDeck ? [{ key: 'h', label: 'Sans mon deck', clear: () => setFilters((f) => ({ ...f, hideDeck: false })) }] : []),
  ];

  return (
    <div className="deck-screen deck-builder">
      <header className="deck-top">
        <button type="button" className="deck-ib" aria-label="Retour à Mes decks" onClick={back}>
          <DeckIcon name="back" size={22} width={2.2} className="gold" />
        </button>
        <label className="deck-name">
          <input ref={nameRef} value={name} aria-label="Nom du deck" maxLength={30} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
          <DeckIcon name="pencil" size={14} width={2.2} className="dim" />
        </label>
        <div className="deck-more">
          <button type="button" className="deck-ib" aria-label="Copier ou supprimer ce deck" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <DeckIcon name="dots" size={20} className="gold" />
          </button>
          {menu ? (
            <>
              <button type="button" className="deck-menu-scrim" aria-label="Fermer le menu" onClick={() => setMenu(false)} />
              <div className="deck-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => void copy()}>
                  <DeckIcon name="copy" size={16} width={2} /> Copier
                </button>
                <button type="button" role="menuitem" className="del" onClick={() => (setMenu(false), setDialog('delete'))}>
                  <DeckIcon name="trash" size={16} width={2} /> Supprimer
                </button>
              </div>
            </>
          ) : null}
        </div>
        <button type="button" className="deck-btn gold" disabled={busy} onClick={() => void save()}>
          Enregistrer
        </button>
      </header>
      <div className="deck-frow">
        <label className="deck-search">
          <DeckIcon name="search" size={16} className="dim" />
          <input type="search" value={filters.query} placeholder="Rechercher une carte" aria-label="Rechercher une carte" onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))} />
          {filters.query ? (
            <button type="button" className="deck-clear" aria-label="Effacer la recherche" onClick={() => setFilters((f) => ({ ...f, query: '' }))}>
              <DeckIcon name="close" size={12} width={3} />
            </button>
          ) : null}
        </label>
        <button type="button" className={'deck-chip' + (nFilters ? ' on' : '')} onClick={() => setSheet('filters')}>
          <DeckIcon name="filter" size={16} />
          Filtres{nFilters ? ` · ${nFilters}` : ''}
        </button>
      </div>
      <div className="deck-active">
        <div className="deck-chiprow">
          {filterChips.map((c) => (
            <button key={c.key} type="button" className="deck-chip small on" aria-label={`Retirer le filtre ${c.label}`} onClick={c.clear}>
              {c.label} <DeckIcon name="close" size={12} width={3} />
            </button>
          ))}
        </div>
        <label className="deck-meta deck-sort">
          {plural(shown.length, 'carte')} · tri :{' '}
          <span className="deck-sort-v">
            {SORT_FR[sort]} <DeckIcon name="chevron" size={12} width={3} />
          </span>
          <select aria-label="Trier par" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {(Object.keys(SORT_FR) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_FR[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="deck-grid" role="list" aria-label="Cartes">
        {shown.map((c) => {
          const on = inDeck.has(c.id);
          return (
            <div key={c.id} role="listitem" className={'deck-cell' + (on ? ' in' : '')} {...press.bind(c.id)}>
              <CardView card={c} size="hand" label={`${on ? 'Retirer' : 'Ajouter'} ${c.name}`} onClick={() => (press.swallow() ? undefined : flip(c.id))} />
              <span className={'deck-mark' + (on ? ' in' : '')} aria-hidden="true">
                <DeckIcon name={on ? 'check' : 'plus'} size={on ? 14 : 16} width={on ? 3.4 : 3} />
              </span>
            </div>
          );
        })}
        {shown.length === 0 ? <p className="deck-empty">Aucune carte ne correspond à ta recherche.</p> : null}
      </div>
      <div className="deck-dock">
        <div className="deck-dock-info">
          <div className="deck-dock-line">
            <span className="deck-count" aria-label={`${cards.length} cartes sur ${DECK_SIZE}`}>
              {cards.length} <small>/ {DECK_SIZE}</small>
            </span>
            <DeckStatus validation={validation} variant="dock" />
          </div>
          <div className="deck-bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (cards.length / DECK_SIZE) * 100)}%` }} />
          </div>
        </div>
        <button type="button" className="deck-btn dark" onClick={() => setSheet('deck')}>
          Voir le deck ›
        </button>
      </div>
      {sheet === 'filters' ? <FilterSheet filters={filters} setFilters={setFilters} inDeck={inDeck} onClose={() => setSheet(null)} /> : null}
      {sheet === 'deck' ? <DeckSheet cards={cards} validation={validation} onRemove={flip} press={press} onClose={() => setSheet(null)} /> : null}
      {dialog === 'leave' ? (
        <ConfirmDialog title="Quitter sans enregistrer ?" confirm="Quitter" cancel="Rester" danger onConfirm={onBack} onCancel={() => setDialog(null)}>
          Tes changements sur « {name.trim() || 'Nouveau deck'} » seront perdus.
        </ConfirmDialog>
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmDialog title="Supprimer ce deck ?" confirm="Supprimer" danger onConfirm={() => void remove()} onCancel={() => setDialog(null)}>
          « {saved.name} » sera supprimé de ton compte. Cette action est définitive.
        </ConfirmDialog>
      ) : null}
      {toast}
    </div>
  );
}

function Sheet({ title, className = '', height, onClose, children, head }: { title: string; className?: string; height: string; onClose: () => void; children: React.ReactNode; head?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <button type="button" className="deck-scrim" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <section className={'deck-sheet ' + className} style={{ height }} role="dialog" aria-label={title}>
        <div className="deck-grab" aria-hidden="true" />
        <div className="deck-shead">
          <h2>{title}</h2>
          {head}
          <button type="button" className="deck-ib" aria-label="Fermer" onClick={onClose}>
            <DeckIcon name="close" size={18} width={3} />
          </button>
        </div>
        {children}
      </section>
    </>
  );
}

function FilterSheet({ filters, setFilters, inDeck, onClose }: { filters: DeckFilters; setFilters: (f: (f: DeckFilters) => DeckFilters) => void; inDeck: ReadonlySet<string>; onClose: () => void }) {
  const [filmQuery, setFilmQuery] = useState('');
  const films = filmList(POOL, SET_FAMILIES);
  const shownFilms = filmList(POOL, SET_FAMILIES, filmQuery);
  const n = filterCards(POOL, filters, inDeck, 'cost').length;
  const flip = <K extends 'categories' | 'rarities' | 'costs' | 'sets'>(key: K, v: DeckFilters[K][number]) => setFilters((f) => ({ ...f, [key]: toggle(f[key] as string[], v as string) }));
  return (
    <Sheet
      title="Filtres"
      className="deck-fsheet"
      height="94%"
      onClose={onClose}
      head={
        <button type="button" className="deck-btn ghost" disabled={activeCount(filters) === 0} onClick={() => setFilters((f) => ({ ...NO_FILTERS, query: f.query }))}>
          Tout effacer
        </button>
      }
    >
      <div className="deck-sbody">
        <div className="deck-secline">
          <span className="deck-sec">Film</span>
          <span className="deck-meta">{plural(films.length, 'film')} · bientôt beaucoup plus</span>
        </div>
        <label className="deck-search">
          <DeckIcon name="search" size={16} className="dim" />
          <input type="search" value={filmQuery} placeholder="Chercher un film" aria-label="Chercher un film" onChange={(e) => setFilmQuery(e.target.value)} />
        </label>
        <div className="deck-flist">
          {shownFilms.map((f) => {
            const on = filters.sets.includes(f.set);
            return (
              <label key={f.set} className="deck-frow2">
                <input type="checkbox" checked={on} onChange={() => flip('sets', f.set)} />
                <span className={'deck-cb' + (on ? ' on' : '')} aria-hidden="true">
                  {on ? <DeckIcon name="check" size={14} width={3} /> : null}
                </span>
                <span>{f.title}</span>
                <span className="deck-meta">{f.count}</span>
              </label>
            );
          })}
          {shownFilms.length === 0 ? <p className="deck-frow2 deck-meta">Aucun film ne correspond.</p> : null}
        </div>
        <span className="deck-sec">Catégorie</span>
        <div className="deck-wrap">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={'deck-chip' + (filters.categories.includes(c) ? ' on' : '')} aria-pressed={filters.categories.includes(c)} onClick={() => flip('categories', c)}>
              <CategoryToken category={c} />
              {CATEGORY_FR[c]}
            </button>
          ))}
        </div>
        <span className="deck-sec">Rareté</span>
        <div className="deck-wrap">
          {RARITIES.map((r) => (
            <button key={r} type="button" className={'deck-chip' + (filters.rarities.includes(r) ? ' on' : '')} aria-pressed={filters.rarities.includes(r)} onClick={() => flip('rarities', r)}>
              <span className={`deck-gem g-${r}`} aria-hidden="true" />
              {RARITY_FR[r]}
            </button>
          ))}
        </div>
        <span className="deck-sec">Coût</span>
        <div className="deck-wrap">
          {COST_BANDS.map((b) => (
            <button key={b} type="button" className={'deck-chip' + (filters.costs.includes(b) ? ' on' : '')} aria-pressed={filters.costs.includes(b)} aria-label={`Coût ${COST_BAND_FR[b]}`} onClick={() => flip('costs', b)}>
              {COST_BAND_FR[b]}
            </button>
          ))}
        </div>
        <label className="deck-switch">
          <input type="checkbox" role="switch" checked={filters.hideDeck} onChange={(e) => setFilters((f) => ({ ...f, hideDeck: e.target.checked }))} />
          <span className="deck-switch-track" aria-hidden="true" />
          Masquer mon deck
        </label>
      </div>
      <div className="deck-sfoot">
        <button type="button" className="deck-btn gold big" onClick={onClose}>
          Voir {plural(n, 'carte')}
        </button>
      </div>
    </Sheet>
  );
}

function DeckSheet({
  cards,
  validation,
  onRemove,
  press,
  onClose,
}: {
  cards: string[];
  validation: ReturnType<typeof validateDeck>;
  onRemove: (id: string) => void;
  press: ReturnType<typeof useLongPress>;
  onClose: () => void;
}) {
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('cinecards.deckView') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const switchView = () => {
    const v = view === 'grid' ? 'list' : 'grid';
    setView(v);
    try {
      localStorage.setItem('cinecards.deckView', v);
    } catch {
      /* ignore */
    }
  };
  const deck = sortCards(
    cards.map((id) => CATALOG.get(id)).filter((c): c is Card => !!c),
    'cost',
  );
  const curve = costCurve(deck);
  const top = Math.max(1, ...curve);
  return (
    <Sheet
      title="Mon deck"
      className="deck-dsheet"
      height="90%"
      onClose={onClose}
      head={
        <>
          <span className="deck-count small">
            {cards.length} <small>/ {DECK_SIZE}</small>
          </span>
          <button type="button" className="deck-ib" aria-label={view === 'grid' ? 'Afficher en liste' : 'Afficher en grille'} onClick={switchView}>
            <DeckIcon name={view === 'grid' ? 'list' : 'grid'} size={18} width={2.2} className="gold" />
          </button>
        </>
      }
    >
      <div className="deck-dstatus">
        <DeckStatus validation={validation} variant="pill" />
        <div className="deck-curve" role="img" aria-label={`Courbe de coût : ${curve.map((n, i) => `${i === 9 ? '9+' : i} : ${n}`).join(', ')}`}>
          {curve.map((n, i) => (
            <span key={i} style={{ height: `${Math.max(2, Math.round((n / top) * 22))}px` }}>
              <em>{i === 9 ? '9+' : i}</em>
            </span>
          ))}
        </div>
      </div>
      <div className="deck-sbody deck-dbody">
        {deck.length === 0 ? <p className="deck-empty">Ton deck est vide. Touche une carte de la grille pour l’ajouter.</p> : null}
        {CATEGORIES.map((cat) => {
          const group = deck.filter((c) => c.category === cat);
          if (!group.length) return null;
          return (
            <section key={cat} className="deck-dgroup" aria-label={CATEGORY_PLURAL[cat]}>
              <div className="deck-secline">
                <CategoryToken category={cat} size={16} />
                <span className="deck-sec">{CATEGORY_PLURAL[cat]}</span>
                <span className="deck-meta">{group.length}</span>
              </div>
              {view === 'grid' ? (
                <div className="deck-dgrid">
                  {group.map((c) => (
                    <div key={c.id} className="deck-dcell" {...press.bind(c.id)}>
                      <CardView card={c} size="hand" label={`Retirer ${c.name} du deck`} onClick={() => (press.swallow() ? undefined : onRemove(c.id))} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="deck-list">
                  {group.map((c) => (
                    <div key={c.id} className="deck-row" {...press.bind(c.id)}>
                      <CostToken card={c} cost={c.cost ?? 0} />
                      <span className="deck-row-tx">
                        <span className="deck-row-n">{c.name}</span>
                        <span className="deck-row-s">
                          <span className={`deck-gem g-${c.rarity}`} aria-hidden="true" /> {RARITY_FR[c.rarity]} · {SET_FAMILIES[c.set] ?? c.set}
                        </span>
                      </span>
                      {c.category === 'character' ? (
                        <span className="deck-row-stat">
                          <span className="a">{Array.isArray(c.atk) ? c.atk.join('·') : c.atk}</span>
                          <span className="h">{Array.isArray(c.hp) ? `${c.hp.length}×${c.hp[0]}` : c.hp}</span>
                        </span>
                      ) : null}
                      <button type="button" className="deck-tg rm" aria-label={`Retirer ${c.name} du deck`} onClick={() => (press.swallow() ? undefined : onRemove(c.id))}>
                        <DeckIcon name="minus" size={16} width={3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="deck-hint">Touche une carte pour la retirer · appui long pour la lire</p>
    </Sheet>
  );
}
