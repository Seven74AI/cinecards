import type { Ability, Card } from '@cinecards/cards';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CATALOG, SET_TITLES } from '../game/catalog.ts';
import { definition, GLOSSARY, REFERENCES_NOTE } from '../game/glossary.ts';
import { abilityBody, abilityTag } from '../game/labels.ts';
import { segmentText } from '../game/richtext.ts';
import { CardView, CATEGORY_FR, RARITY_FR } from './CardView.tsx';
import { Icon } from './Icon.tsx';

/** Story 11.8: keyword bubbles, links between cards, and the "Règles et mots-clés" screen. */
interface Refs {
  openCard: (cardId: string, ability?: number) => void;
  openRules: () => void;
}
const RefContext = createContext<Refs>({ openCard: () => {}, openRules: () => {} });
export const useRefs = () => useContext(RefContext);

export function RefProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<{ id: string; ability?: number; key: number } | null>(null);
  const [rules, setRules] = useState(false);
  const refs = useMemo<Refs>(
    () => ({
      openCard: (id, ability) => setCard({ id, ability, key: Date.now() }),
      openRules: () => setRules(true),
    }),
    [],
  );
  return (
    <RefContext.Provider value={refs}>
      {children}
      {rules ? <RulesScreen onClose={() => setRules(false)} /> : null}
      {card ? <CardInfo key={card.key} cardId={card.id} ability={card.ability} onClose={() => setCard(null)} /> : null}
    </RefContext.Provider>
  );
}

/** Ability text with its trigger label: keywords show their definition, quoted cards and abilities open that card. */
export function AbilityText({ card, ability }: { card: Card; ability: Ability }) {
  const { openCard } = useRefs();
  const [open, setOpen] = useState<string | null>(null);
  const tag = abilityTag(card, ability);
  const body = abilityBody(card, ability);
  const segments = useMemo(() => segmentText(body, CATALOG, card.id), [body, card.id]);
  const toggle = (term: string) => setOpen((o) => (o === term ? null : term));
  const def = open ? definition(open) : undefined;
  return (
    <>
      {definition(tag.label) ? (
        <button type="button" className={'tg kw-tag t-' + tag.tone} onClick={() => toggle(tag.label)} aria-expanded={open === tag.label}>
          {tag.label}
        </button>
      ) : (
        <span className={'tg t-' + tag.tone}>{tag.label}</span>
      )}
      {segments.map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : s.kind === 'keyword' ? (
          <button key={i} type="button" className="kw" onClick={() => toggle(s.term)} aria-expanded={open === s.term}>
            {s.text}
          </button>
        ) : (
          <button key={i} type="button" className="ref" onClick={() => openCard(s.cardId, s.kind === 'ability' ? s.index : undefined)} title={`Voir ${CATALOG.get(s.cardId)?.name ?? ''}`}>
            {s.text}
          </button>
        ),
      )}
      {def ? (
        <span className="kw-bubble" role="note">
          <b>{def.term}</b> {def.text}
        </span>
      ) : null}
    </>
  );
}

/** Read-only sheet of any catalog card, opened from a reference; the referenced ability is highlighted. */
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
            <p className="muted">
              {CATEGORY_FR[card.category] ?? card.category} · {RARITY_FR[card.rarity] ?? card.rarity} · {card.role} · {SET_TITLES[card.set] ?? card.set}
            </p>
          </div>
        </div>
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
