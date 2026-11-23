import type { Ability, Card } from '@cinecards/cards';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { CATALOG, SET_TITLES } from '../game/catalog.ts';
import { definition, GLOSSARY, REFERENCES_NOTE } from '../game/glossary.ts';
import { abilityBody, abilityTag } from '../game/labels.ts';
import { segmentText } from '../game/richtext.ts';
import { CardView, CATEGORY_FR, RARITY_FR } from './CardView.tsx';
import { Icon } from './Icon.tsx';

/**
 * Story 11.8: keyword bubbles, links between cards, and the "Règles et mots-clés" screen.
 * Story 13.1: a link opens a light preview over whatever is open (the sheet underneath stays), a mouse
 * hover previews without a click, and the table lights up the slot of the previewed card (`previewId`).
 */
interface Refs {
  /** Full read-only sheet of a catalog card; sheets stack, closing one goes back to the previous. */
  openCard: (cardId: string, ability?: number) => void;
  /** Preview overlay of a cited card (tap on a link). */
  previewCard: (cardId: string, ability?: number) => void;
  /** Non-modal preview while the mouse rests on a link; null hides it. */
  hoverCard: (cardId: string | null, ability?: number) => void;
  openRules: () => void;
  /** Card id shown in the preview (tapped or hovered), for the table's slot glow. */
  previewId: string | null;
}
const RefContext = createContext<Refs>({ openCard: () => {}, previewCard: () => {}, hoverCard: () => {}, openRules: () => {}, previewId: null });
export const useRefs = () => useContext(RefContext);

type Shown = { id: string; ability?: number; key: number };

export function RefProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<Shown[]>([]);
  const [preview, setPreview] = useState<Shown | null>(null);
  const [hover, setHover] = useState<Shown | null>(null);
  const [rules, setRules] = useState(false);
  const shownPreview = preview ?? hover;
  const refs = useMemo<Refs>(
    () => ({
      openCard: (id, ability) => {
        setPreview(null);
        setHover(null);
        setSheets((s) => [...s, { id, ability, key: Date.now() }]);
      },
      previewCard: (id, ability) => {
        setHover(null);
        setPreview({ id, ability, key: Date.now() });
      },
      hoverCard: (id, ability) => setHover(id ? { id, ability, key: Date.now() } : null),
      openRules: () => setRules(true),
      previewId: shownPreview?.id ?? null,
    }),
    [shownPreview?.id],
  );
  const top = sheets[sheets.length - 1];
  return (
    <RefContext.Provider value={refs}>
      {children}
      {rules ? <RulesScreen onClose={() => setRules(false)} /> : null}
      {top ? <CardInfo key={top.key} cardId={top.id} ability={top.ability} onClose={() => setSheets((s) => s.slice(0, -1))} /> : null}
      {shownPreview ? (
        <CardPreview
          key={shownPreview.key}
          cardId={shownPreview.id}
          ability={shownPreview.ability}
          hover={!preview}
          onClose={() => {
            setPreview(null);
            setHover(null);
          }}
          onSheet={() => refs.openCard(shownPreview.id, shownPreview.ability)}
        />
      ) : null}
    </RefContext.Provider>
  );
}

const HOVER_DELAY_MS = 250;

/**
 * Ability text with its trigger label: keywords show their definition, cited cards and abilities open a preview.
 * Story 14.3: `still` draws the same text with the same classes but nothing to tap (the full cards of the detailed
 * hand are buttons themselves: a tap anywhere opens the sheet, where the keywords and links work).
 */
export function AbilityText({ card, ability, still }: { card: Card; ability: Ability; still?: boolean }) {
  const { previewCard, hoverCard } = useRefs();
  const [open, setOpen] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tag = abilityTag(card, ability);
  const body = abilityBody(card, ability);
  const segments = useMemo(() => segmentText(body, CATALOG, card.id), [body, card.id]);
  const toggle = (term: string) => setOpen((o) => (o === term ? null : term));
  const def = open ? definition(open) : undefined;
  const stopHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  useEffect(() => stopHover, []);
  if (still)
    return (
      <>
        <span className={'tg t-' + tag.tone + (definition(tag.label) ? ' kw-tag' : '')}>{tag.label}</span>
        {segments.map((s, i) => (
          <span key={i} className={s.kind === 'text' ? undefined : s.kind === 'keyword' ? 'kw' : 'ref'}>
            {s.text}
          </span>
        ))}
      </>
    );
  return (
    <>
      {definition(tag.label) ? (
        <button type="button" className={'tg kw-tag t-' + tag.tone} onClick={() => toggle(tag.label)} aria-expanded={open === tag.label}>
          {tag.label}
        </button>
      ) : (
        <span className={'tg t-' + tag.tone}>{tag.label}</span>
      )}
      {segments.map((s, i) => {
        if (s.kind === 'text') return <span key={i}>{s.text}</span>;
        if (s.kind === 'keyword')
          return (
            <button key={i} type="button" className="kw" onClick={() => toggle(s.term)} aria-expanded={open === s.term}>
              {s.text}
            </button>
          );
        const index = s.kind === 'ability' ? s.index : undefined;
        return (
          <button
            key={i}
            type="button"
            className="ref"
            onClick={() => {
              stopHover();
              previewCard(s.cardId, index);
            }}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'mouse') return;
              stopHover();
              hoverTimer.current = setTimeout(() => hoverCard(s.cardId, index), HOVER_DELAY_MS);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'mouse') return;
              stopHover();
              hoverCard(null);
            }}
            title={`Voir ${CATALOG.get(s.cardId)?.name ?? ''}`}
          >
            {s.text}
          </button>
        );
      })}
      {def ? (
        <span className="kw-bubble" role="note">
          <b>{def.term}</b> {def.text}
        </span>
      ) : null}
    </>
  );
}

function CardHead({ card }: { card: Card }) {
  return (
    <p className="muted">
      {CATEGORY_FR[card.category] ?? card.category} · {RARITY_FR[card.rarity] ?? card.rarity} · {card.role} · {SET_TITLES[card.set] ?? card.set}
    </p>
  );
}

function AbilityList({ card, ability, hl }: { card: Card; ability?: number; hl?: Ref<HTMLLIElement> }) {
  return (
    <ol className="abilities">
      {card.abilities.map((ab, i) => (
        <li key={i} ref={i === ability ? hl : undefined} className={'ability k-' + ab.kind + (i === ability ? ' is-highlighted' : '')}>
          <div className="ability-head">
            <strong>{ab.name}</strong>
          </div>
          <p>
            <AbilityText card={card} ability={ab} />
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Preview of a cited card (story 13.1): the card at a readable size and its abilities, over the open sheet.
 * Closed by a tap outside, Escape or ×; "Voir la fiche" opens the full sheet. When the card is on the table,
 * its slot glows (Table reads `previewId`): the sheet underneath fades and the preview moves to the other half.
 */
function CardPreview({ cardId, ability, hover, onClose, onSheet }: { cardId: string; ability?: number; hover: boolean; onClose: () => void; onSheet: () => void }) {
  const card = CATALOG.get(cardId);
  const hl = useRef<HTMLLIElement>(null);
  const [place, setPlace] = useState<{ at: 'top' | 'bottom' | 'middle'; maxHeight?: number }>({ at: 'middle' });
  useLayoutEffect(() => {
    const glow = document.querySelector('.ref-glow');
    document.body.classList.toggle('ref-peek', !!glow);
    if (glow) {
      // keep the glowing slot in sight: the preview takes the other half, never over the slot
      const r = glow.getBoundingClientRect();
      const above = r.top + r.height / 2 >= window.innerHeight / 2;
      const room = Math.floor((above ? r.top : window.innerHeight - r.bottom) - 20);
      setPlace({ at: above ? 'top' : 'bottom', maxHeight: room >= 220 ? room : undefined });
    }
    return () => document.body.classList.remove('ref-peek');
  }, [cardId]);
  useEffect(() => {
    hl.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  useEffect(() => {
    if (hover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [hover, onClose]);
  if (!card) return null;
  return (
    <div className={'preview-layer' + (hover ? ' hover' : '')} data-at={place.at}>
      {!hover ? <button type="button" className="preview-scrim" aria-label="Fermer l’aperçu" onClick={onClose} /> : null}
      <div className="preview parchment" role="dialog" aria-label={`Aperçu : ${card.name}`} style={place.maxHeight ? { maxHeight: place.maxHeight } : undefined}>
        {!hover ? (
          <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Fermer">
            <Icon name="close" size={18} />
          </button>
        ) : null}
        <div className="preview-head">
          <CardView card={card} size="big" />
          <div className="sheet-meta">
            <h2>{card.name}</h2>
            <CardHead card={card} />
          </div>
        </div>
        <AbilityList card={card} ability={ability} hl={hl} />
        {!hover ? (
          <div className="preview-foot">
            <button type="button" className="btn small" onClick={onSheet}>
              Voir la fiche
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Read-only sheet of any catalog card, opened from the collection or "Voir la fiche"; the cited ability is highlighted. */
function CardInfo({ cardId, ability, onClose }: { cardId: string; ability?: number; onClose: () => void }) {
  const card = CATALOG.get(cardId);
  const hl = useRef<HTMLLIElement>(null);
  useEffect(() => {
    hl.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  if (!card) return null;
  return (
    <aside className="sheet ref-sheet" role="dialog" aria-label={card.name}>
      <button type="button" className="sheet-scrim" aria-label="Fermer" onClick={onClose} />
      <div className="sheet-body parchment">
        <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Fermer">
          <Icon name="close" size={18} />
        </button>
        <div className="sheet-head">
          <CardView card={card} size="big" />
          <div className="sheet-meta">
            <h2>{card.name}</h2>
            <CardHead card={card} />
          </div>
        </div>
        <AbilityList card={card} ability={ability} hl={hl} />
      </div>
    </aside>
  );
}

/** "Règles et mots-clés": generated from glossaire-mots-cles.md. */
function RulesScreen({ onClose }: { onClose: () => void }) {
  return (
    <aside className="sheet ref-sheet rules-screen" role="dialog" aria-label="Règles et mots-clés">
      <button type="button" className="sheet-scrim" aria-label="Fermer" onClick={onClose} />
      <div className="sheet-body parchment">
        <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Fermer">
          <Icon name="close" size={18} />
        </button>
        <h2>Règles et mots-clés</h2>
        {GLOSSARY.map((s) => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            <dl>
              {s.entries.map((e) => (
                <div key={e.term} className="rule">
                  <dt>{e.term}</dt>
                  <dd>{e.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {REFERENCES_NOTE.length ? (
          <section>
            <h3>Renvois entre cartes</h3>
            <ul className="rules-notes">
              {REFERENCES_NOTE.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
