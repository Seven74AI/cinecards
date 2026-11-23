import { validateDeck } from '@cinecards/cards/deck';
import type { Catalog } from '@cinecards/engine';
import type { Account, AuthError, AuthResult } from '../auth/service.ts';
import type { Db } from '../db/db.ts';
import { countDecks, deleteDeck, findDeck, insertDeck, listDecks, parseCards, updateDeck, type DeckRow } from '../db/decks.ts';

/** Limits of the deck builder (story 10.2). */
export const DECK_LIMITS = { decksPerAccount: 20, nameLength: 30, cards: 60 } as const;
export const DEFAULT_DECK_NAME = 'Nouveau deck';

/** Player-facing messages (French, tutoiement). */
export const DECK_MESSAGES = {
  unauthorized: 'Ta session a expiré. Reconnecte-toi.',
  bad_name: `Le nom d’un deck fait ${DECK_LIMITS.nameLength} caractères au plus.`,
  bad_cards: `Un deck compte ${DECK_LIMITS.cards} cartes au plus.`,
  unknown_card: 'Ce deck contient une carte inconnue.',
  deck_limit: `Tu as déjà ${DECK_LIMITS.decksPerAccount} decks : supprimes-en un d’abord.`,
  not_found: 'Ce deck n’existe plus.',
} as const;

/** A deck as the API sends it: its status is always computed here, never trusted from the client. */
export interface DeckInfo {
  id: number;
  name: string;
  cards: string[];
  valid: boolean;
  errors: string[];
  updatedAt: number;
}

const fail = (status: number, error: keyof typeof DECK_MESSAGES, extra?: string): AuthError => ({ ok: false, status, error, message: DECK_MESSAGES[error] + (extra ? ` (${extra})` : '') });

/**
 * Saved constructed decks (story 10.2). An account sees and changes only its own decks; an incomplete deck can be
 * saved (its status says what is missing), cards must exist in the catalog.
 */
export class DeckService {
  private readonly playable: Set<string>;
  constructor(
    private readonly db: Db,
    private readonly accountOf: (token: unknown) => Account | null,
    private readonly catalog: Catalog,
    playable: Iterable<string>,
    private readonly now: () => number = Date.now,
  ) {
    this.playable = new Set(playable);
  }

  info(row: DeckRow): DeckInfo {
    const cards = parseCards(row.cards);
    const v = validateDeck(cards, this.catalog, this.playable);
    return { id: row.id, name: row.name, cards, valid: v.ok, errors: v.ok ? [] : v.errors.map((e) => e.message), updatedAt: row.updated_at };
  }

  list(token: unknown): AuthResult<{ decks: DeckInfo[] }> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized');
    return { ok: true, decks: listDecks(this.db, me.id).map((r) => this.info(r)) };
  }

  create(token: unknown, body: Record<string, unknown>): AuthResult<{ deck: DeckInfo }> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized');
    const name = this.name(body.name);
    if (typeof name !== 'string') return name;
    const cards = this.cards(body.cards ?? []);
    if (!Array.isArray(cards)) return cards;
    if (countDecks(this.db, me.id) >= DECK_LIMITS.decksPerAccount) return fail(409, 'deck_limit');
    const id = insertDeck(this.db, me.id, name, cards, this.now());
    return { ok: true, deck: this.info(findDeck(this.db, id, me.id)!) };
  }

  /** Changes the name and/or the cards; a field left out keeps its value. */
  update(token: unknown, id: number, body: Record<string, unknown>): AuthResult<{ deck: DeckInfo }> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized');
    const row = findDeck(this.db, id, me.id);
    if (!row) return fail(404, 'not_found');
    const name = body.name === undefined ? row.name : this.name(body.name);
    if (typeof name !== 'string') return name;
    const cards = body.cards === undefined ? parseCards(row.cards) : this.cards(body.cards);
    if (!Array.isArray(cards)) return cards;
    updateDeck(this.db, id, me.id, name, cards, this.now());
    return { ok: true, deck: this.info(findDeck(this.db, id, me.id)!) };
  }

  remove(token: unknown, id: number): AuthResult<object> {
    const me = this.accountOf(token);
    if (!me) return fail(401, 'unauthorized');
    return deleteDeck(this.db, id, me.id) ? { ok: true } : fail(404, 'not_found');
  }

  /** 1 to 30 characters once trimmed (inner runs of spaces become one); empty or missing = "Nouveau deck". */
  private name(v: unknown): string | AuthError {
    if (v === undefined || v === null) return DEFAULT_DECK_NAME;
    if (typeof v !== 'string') return fail(400, 'bad_name');
    // eslint-disable-next-line no-control-regex
    const name = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    if (!name) return DEFAULT_DECK_NAME;
    return [...name].length > DECK_LIMITS.nameLength ? fail(400, 'bad_name') : name;
  }

  /** 0 to 60 known card ids; duplicates are dropped (one copy per card), order kept. */
  private cards(v: unknown): string[] | AuthError {
    if (!Array.isArray(v) || v.length > DECK_LIMITS.cards || v.some((x) => typeof x !== 'string')) return fail(400, 'bad_cards');
    const unknown = (v as string[]).find((id) => !this.catalog.has(id));
    if (unknown !== undefined) return fail(400, 'unknown_card', unknown.slice(0, 40));
    return [...new Set(v as string[])];
  }
}
