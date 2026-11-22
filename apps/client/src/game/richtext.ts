import type { Card } from '@cinecards/cards';

/**
 * Keyword and cross-reference detection in card texts (story 11.8).
 * Each glossary term maps to the forms it takes in the card texts ("réduit au silence", "GUÉRIT", "la hâte"…).
 * The terms must exist in glossaire-mots-cles.md (checked by a test), which holds the definitions.
 */
export const KEYWORD_FORMS: Record<string, string> = {
  "À l'arrivée": "à l['’]arrivée",
  'Attaque spéciale': 'attaque spéciale',
  'À la mort': 'à la mort',
  'Début de votre tour': 'début de votre tour',
  'Fin de votre tour': 'fin de votre tour',
  'Quand il attaque': 'quand il attaque',
  'Quand il est attaqué': 'quand il est attaqué',
  'Quand il détruit une carte': 'quand il détruit une carte',
  Réaction: 'réaction',
  'Tous les N tours': 'tous les \\d+ tours',
  'Usage unique': 'usage unique|une fois par partie',
  'Choix exclusif': 'au choix',
  "Jusqu'à N": "jusqu['’]à \\d+",
  Adjacent: 'adjacent\\p{L}*',
  Famille: 'monde de',
  'Cartes neutres': 'cartes? neutres?',
  'Attend un tour': 'attend un tour',
  Hâte: 'hâte',
  Riposte: 'ripost\\p{L}*',
  'À distance': 'à distance',
  'Multi-attaque (N)': 'multi-attaque|attaquer (?:2|deux|une deuxième) fois|\\d+ cibles par tour',
  Mortel: 'mortel\\p{L}*',
  Barrage: 'barrage',
  Silence: 'silence',
  'Poison (N)': 'poison\\p{L}*|empoisonn\\p{L}*',
  'Bouclier (X)': 'bouclier\\p{L}*',
  Immunité: 'immunit\\p{L}*|immunisé\\p{L}*',
  Insensible: 'insensible\\p{L}*',
  Guérir: 'guéri\\p{L}*',
  'Soin (X)': 'soign\\p{L}*|soin',
  Absorber: 'absorb\\p{L}*',
  Copier: 'copi\\p{L}*',
  Renvoyer: 'renvo\\p{L}*',
  'Invoquer depuis': 'invoqu\\p{L}*|débarque\\p{L}*',
  'Bonus de pièces (+N)': 'bonus de pièces',
  'Plafond de stock (+N)': 'plafond de stock',
};

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'keyword'; text: string; term: string }
  | { kind: 'card'; text: string; cardId: string }
  | { kind: 'ability'; text: string; cardId: string; index: number };

const KEYWORD_RE = new RegExp(
  Object.values(KEYWORD_FORMS)
    .map((f) => `(?<![\\p{L}\\p{N}])(?:${f})(?![\\p{L}\\p{N}])`)
    .map((f) => `(${f})`)
    .join('|'),
  'giu',
);
const TERMS = Object.keys(KEYWORD_FORMS);

const norm = (s: string) =>
  s
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([!?…])/g, '$1')
    .toLowerCase()
    .trim();
const stripArticle = (s: string) => s.replace(/^(?:les|le|la|l')\s*/, '');

/** Card or ability named by a quoted reference: « Trinity », « Au galop ! ». Card names win over ability names. */
export function resolveReference(quote: string, catalog: ReadonlyMap<string, Card>): Segment | null {
  const q = norm(quote);
  if (!q) return null;
  const cards = [...catalog.values()];
  const exact = cards.find((c) => {
    const n = norm(c.name);
    return n === q || stripArticle(n) === stripArticle(q) || n.split(' a.k.a ')[0] === q;
  });
  if (exact) return { kind: 'card', text: quote, cardId: exact.id };
  for (const c of cards) {
    const i = c.abilities.findIndex((a) => norm(a.name) === q);
    if (i >= 0) return { kind: 'ability', text: quote, cardId: c.id, index: i };
  }
  const within = cards.filter((c) => ` ${norm(c.name)} `.includes(` ${q} `));
  if (within.length === 1) return { kind: 'card', text: quote, cardId: within[0]!.id };
  return null;
}

function keywords(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(KEYWORD_RE)) {
    const at = m.index ?? 0;
    const g = m.slice(1).findIndex((x) => x !== undefined);
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) });
    out.push({ kind: 'keyword', text: m[0], term: TERMS[g]! });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** Splits a card text into plain text, keywords and references to other cards or abilities. */
export function segmentText(text: string, catalog: ReadonlyMap<string, Card>, selfId?: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(/«\s*([^»]+?)\s*»/g)) {
    const ref = resolveReference(m[1]!, catalog);
    if (!ref || (ref.kind === 'card' && ref.cardId === selfId)) continue;
    const at = m.index ?? 0;
    out.push(...keywords(text.slice(last, at)));
    out.push({ ...ref, text: m[0] });
    last = at + m[0].length;
  }
  out.push(...keywords(text.slice(last)));
  return out;
}
