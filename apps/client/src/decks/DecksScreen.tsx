import { useCallback, useEffect, useState } from 'react';
import type { Card } from '@cinecards/cards';
import { DECK_SIZE } from '@cinecards/cards';
import { cardArt, CATALOG, SET_FAMILIES } from '../game/catalog.ts';
import { createDeck, deleteDeck, listDecks, type SavedDeck } from '../account/api.ts';
import type { SignedIn } from '../account/session.ts';
import { CostToken, RARITY_CLASS } from '../ui/CardView.tsx';
import { DeckBuilder } from './DeckBuilder.tsx';
import { copyName, costOf, deckFilms } from './filters.ts';
import { DeckIcon } from './icons.tsx';
import { ConfirmDialog, DeckStatus, useToast } from './parts.tsx';

/** Decks per account (the server refuses more). */
export const MAX_DECKS = 20;

const cardsOf = (d: SavedDeck) => d.cards.map((id) => CATALOG.get(id)).filter((c): c is Card => !!c);

/** Three cards of the deck, the most expensive ones, fanned out. */
function Fan({ cards }: { cards: Card[] }) {
  const top = [...cards].sort((a, b) => costOf(b) - costOf(a) || a.name.localeCompare(b.name, 'fr')).slice(0, 3);
  return (
    <span className="deck-fan" aria-hidden="true">
      {top.length === 0 ? <span className="deck-fan-empty" /> : null}
      {top.map((c, i) => (
        <span key={c.id} className="deck-fan-card" style={{ left: `${i * 12}px`, transform: `rotate(${(i - (top.length - 1) / 2) * 8}deg)`, zIndex: i }}>
          {/* a picture of the card, not CardView: it sits inside the "Modifier" button */}
          <span className={`deck-mini ${RARITY_CLASS[c.rarity] ?? ''}`}>
            <span className="deck-mini-art">{cardArt(c) ? <img src={cardArt(c)} alt="" draggable={false} /> : null}</span>
            <CostToken card={c} cost={c.cost ?? 0} />
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * "Mes decks" (story 10.2): the decks saved on the account, with their status, Modifier / Copier / Supprimer and
 * "Nouveau"; opens the builder full screen.
 */
export function DecksScreen({ me, onClose }: { me: SignedIn; onClose: () => void }) {
  const [decks, setDecks] = useState<SavedDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ deck: SavedDeck | null; key: number } | null>(null);
  const [confirm, setConfirm] = useState<SavedDeck | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setError(null);
    const r = await listDecks(me.token);
    if (r.ok) setDecks(r.data.decks);
    else setError(r.message);
  }, [me.token]);
  useEffect(() => {
    void load();
  }, [load]);

  if (editing) {
    return (
      <DeckBuilder
        key={editing.key}
        me={me}
        initial={editing.deck}
        onBack={() => {
          setEditing(null);
          void load();
        }}
        onReplace={(deck) => setEditing({ deck, key: Date.now() })}
      />
    );
  }

  const full = (decks?.length ?? 0) >= MAX_DECKS;
  const copy = async (d: SavedDeck) => {
    if (busy) return;
    setBusy(true);
    const r = await createDeck(me.token, copyName(d.name), d.cards);
    setBusy(false);
    if (!r.ok) return show(r.message, true);
    show(`« ${r.data.deck.name} » créé`);
    void load();
  };
  const remove = async (d: SavedDeck) => {
    setConfirm(null);
    setBusy(true);
    const r = await deleteDeck(me.token, d.id);
    setBusy(false);
    if (!r.ok && r.status !== 404) return show(r.message, true);
    setDecks((ds) => ds?.filter((x) => x.id !== d.id) ?? null);
  };

  return (
    <div className="deck-screen deck-mine">
      <header className="deck-mhead">
        <button type="button" className="deck-ib" aria-label="Retour au menu" onClick={onClose}>
          <DeckIcon name="back" size={22} width={2.2} className="gold" />
        </button>
        <h1>Mes decks</h1>
        <button type="button" className="deck-btn gold" disabled={full || decks === null} onClick={() => setEditing({ deck: null, key: Date.now() })}>
          <DeckIcon name="plus" size={16} width={3} />
          Nouveau
        </button>
      </header>
      <div className="deck-dlist">
        <p className="deck-meta deck-intro">Un deck compte exactement {DECK_SIZE} cartes, une copie de chaque. Seuls les decks valides peuvent être choisis en salle.</p>
        {error ? (
          <div className="deck-error">
            <p>{error}</p>
            <button type="button" className="deck-btn ghost" onClick={() => void load()}>
              Réessayer
            </button>
          </div>
        ) : decks === null ? (
          <p className="deck-meta deck-center">Chargement…</p>
        ) : (
          <>
            {decks.map((d) => {
              const cs = cardsOf(d);
              return (
                <article key={d.id} className={'deck-item' + (d.valid ? '' : ' bad')} aria-label={d.name}>
                  <button type="button" className="deck-itop" aria-label={`Modifier ${d.name}`} onClick={() => setEditing({ deck: d, key: Date.now() })}>
                    <Fan cards={cs} />
                    <span className="deck-it">
                      <span className="deck-dn">{d.name}</span>
                      <span className="deck-df">{deckFilms(cs, SET_FAMILIES).join(' · ') || 'Aucune carte'}</span>
                      <span className="deck-dline">
                        <span className="deck-dc">
                          {d.cards.length} / {DECK_SIZE}
                        </span>
                        <DeckStatus validation={{ ok: d.valid, errors: d.errors }} variant="line" />
                      </span>
                    </span>
                  </button>
                  <div className="deck-dact">
                    <button type="button" onClick={() => setEditing({ deck: d, key: Date.now() })}>
                      <DeckIcon name="pencil" size={18} width={2} /> Modifier
                    </button>
                    <button type="button" disabled={full || busy} aria-label={`Copier ${d.name}`} onClick={() => void copy(d)}>
                      <DeckIcon name="copy" size={18} width={2} /> Copier
                    </button>
                    <button type="button" className="del" aria-label={`Supprimer ${d.name}`} onClick={() => setConfirm(d)}>
                      <DeckIcon name="trash" size={18} width={2} /> Supprimer
                    </button>
                  </div>
                </article>
              );
            })}
            {decks.length === 0 ? (
              <button type="button" className="deck-new" onClick={() => setEditing({ deck: null, key: Date.now() })}>
                <DeckIcon name="plus" size={16} width={3} /> Nouveau deck
              </button>
            ) : null}
            {full ? <p className="deck-meta deck-center">{MAX_DECKS} decks au plus : supprimes-en un pour en créer un autre.</p> : null}
            <p className="deck-meta deck-center">Enregistrés sur ton compte · visibles sur tous tes appareils</p>
          </>
        )}
      </div>
      {confirm ? (
        <ConfirmDialog title="Supprimer ce deck ?" confirm="Supprimer" danger onConfirm={() => void remove(confirm)} onCancel={() => setConfirm(null)}>
          « {confirm.name} » sera supprimé de ton compte. Cette action est définitive.
        </ConfirmDialog>
      ) : null}
      {toast}
    </div>
  );
}
