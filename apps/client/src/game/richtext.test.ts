import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog.ts';
import { definition, GLOSSARY, parseGlossary, REFERENCES_NOTE } from './glossary.ts';
import { KEYWORD_FORMS, resolveReference, segmentText } from './richtext.ts';

describe('glossary from glossaire-mots-cles.md (story 11.8)', () => {
  it('reads the sections and definitions of the markdown file', () => {
    expect(GLOSSARY.map((s) => s.title)).toContain('Combat');
    expect(definition('Barrage')?.text).toMatch(/vos PV ne peuvent pas être attaqués/);
    expect(definition('attaque spéciale')?.text).toMatch(/Remplace l'attaque normale/);
    expect(REFERENCES_NOTE.length).toBeGreaterThan(0);
  });

  it('every detected keyword has a definition in the file', () => {
    for (const term of Object.keys(KEYWORD_FORMS)) expect(definition(term), term).toBeDefined();
  });

  it('ignores the header and separator rows', () => {
    const s = parseGlossary('## A\n\n| Mot-clé | Texte en jeu |\n|---|---|\n| Foo | Bar baz. |\n\n## Notes\n\nsans tableau');
    expect(s).toEqual([{ title: 'A', entries: [{ term: 'Foo', text: 'Bar baz.' }] }]);
  });
});

describe('keywords and references in card texts', () => {
  const kinds = (text: string, self?: string) => segmentText(text, CATALOG, self).filter((s) => s.kind !== 'text');

  it('finds inflected keywords', () => {
    expect(kinds('Réduit au SILENCE un personnage adverse.').map((s) => s.kind === 'keyword' && s.term)).toEqual(['Silence']);
    expect(kinds('GUÉRIT TOUTES vos cartes.').map((s) => s.kind === 'keyword' && s.term)).toEqual(['Guérir']);
    expect(kinds("Choisissez jusqu'à 3 cartes, jusqu'à la fin du tour.").map((s) => s.text)).toEqual(["jusqu'à 3"]);
    expect(kinds('Arthur a la hâte.').map((s) => (s.kind === 'keyword' ? s.term : s.kind))).toEqual(['card', 'Hâte']);
  });

  it('links a quoted ability to its card and a quoted card name to the card', () => {
    const patsy = CATALOG.get('hg-patsy')!;
    const galop = segmentText(patsy.abilities[0]!.text, CATALOG, patsy.id).find((s) => s.kind === 'ability');
    expect(galop).toMatchObject({ kind: 'ability', cardId: 'hg-arthur', text: '« Au galop ! »' });
    expect(resolveReference('Trinity', CATALOG)).toMatchObject({ kind: 'card', cardId: 'mx-trinity' });
    expect(resolveReference('Sentinelles', CATALOG)).toMatchObject({ kind: 'card', cardId: 'mx-sentinels' });
    expect(resolveReference('Matrix', CATALOG)).toBeNull();
  });
});

/**
 * Story 13.1: every card of the MVP that names another card, quoted or not, links to it.
 * Quotes that name no card (a world, a movie line) are listed here; so are capitalised words that only look like a card.
 */
const NOT_A_CARD_QUOTES = new Set(['Matrix', 'MATRIX', 'Les Agents', 'Le Lazar', 'Le Lazer', 'la femme en robe rouge']);
const NOT_A_CARD_WORDS = new Set(['Morpheus', 'Matrice']);
const NAME_STOPWORDS = new Set(['Le', 'La', 'Les', 'Sire', 'Agent', 'Chef', 'Unité', 'Capitaine', 'Amiral', 'The']);
/** Who cites whom in the MVP texts (card ids, either way of citing). */
const EXPECTED_REFS: Record<string, string[]> = {
  'hg-arthur': ['hg-patsy'],
  'hg-patsy': ['hg-arthur'],
  'hs-ramada': ['hs-topper'],
  'mx-apu': ['mx-iffune'],
  'mx-emp': ['mx-sentinels', 'mx-apu', 'mx-smith'],
  'mx-tank': ['mx-dozer'],
  'mx-neo': ['mx-trinity'],
  'wc-latrell': ['wc-marcus'],
  'wc-marcus': ['wc-kevin'],
  'wc-gomez': ['wc-marcus', 'wc-kevin'],
};

describe('every card cited in an MVP card text is recognised (story 13.1)', () => {
  const cards = [...CATALOG.values()];
  const refsOf = (cardId: string) => {
    const card = CATALOG.get(cardId)!;
    return card.abilities.flatMap((a) => segmentText(a.text, CATALOG, card.id)).filter((s) => s.kind === 'card' || s.kind === 'ability');
  };

  it('links unquoted names and aliases: Patsy names Arthur, Ramada names Topper', () => {
    const patsy = refsOf('hg-patsy');
    expect(patsy).toContainEqual({ kind: 'card', text: 'Arthur', cardId: 'hg-arthur' });
    expect(patsy.some((s) => s.kind === 'ability' && s.text === '« Au galop ! »')).toBe(true);
    expect(refsOf('hs-ramada')).toEqual([{ kind: 'card', text: 'Topper', cardId: 'hs-topper' }]);
  });

  it('never links a card to itself, nor « la Matrice » to the terrain', () => {
    for (const c of cards) expect(refsOf(c.id).filter((s) => s.kind === 'card' && s.cardId === c.id), c.id).toEqual([]);
    expect(segmentText('Néo s’équipe dans la Matrice.', CATALOG, 'mx-neo').some((s) => s.kind === 'card')).toBe(false);
  });

  it('matches the expected table of references', () => {
    const found = Object.fromEntries(
      cards.map((c) => [c.id, [...new Set(refsOf(c.id).map((s) => (s as { cardId: string }).cardId))].sort()] as const).filter(([, ids]) => ids.length),
    );
    const want = Object.fromEntries(Object.entries(EXPECTED_REFS).map(([k, v]) => [k, [...v].sort()]));
    expect(found).toEqual(want);
  });

  it('every quote names a card or ability, or is a known non-card quote', () => {
    for (const c of cards)
      for (const a of c.abilities)
        for (const m of a.text.matchAll(/«\s*([^»]+?)\s*»/g)) {
          if (NOT_A_CARD_QUOTES.has(m[1]!)) continue;
          expect(resolveReference(m[1]!, CATALOG), `${c.id}: « ${m[1]} »`).not.toBeNull();
        }
  });

  it('every capitalised word that belongs to another card name is linked', () => {
    const owner = new Map<string, Set<string>>();
    for (const c of cards)
      for (const f of [c.name, ...(c.aliases ?? [])])
        for (const w of f.split(/[\s,']+/)) if (/^\p{Lu}/u.test(w) && w.length >= 3 && !NAME_STOPWORDS.has(w)) owner.set(w, (owner.get(w) ?? new Set()).add(c.id));
    for (const c of cards)
      for (const a of c.abilities) {
        const linked = segmentText(a.text, CATALOG, c.id)
          .filter((s) => s.kind === 'card' || s.kind === 'ability')
          .map((s) => s.text)
          .join(' ');
        for (const m of a.text.matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{L}.]*/gu)) {
          const ids = owner.get(m[0]);
          if (!ids || ids.has(c.id) || NOT_A_CARD_WORDS.has(m[0]) || m[0] === m[0].toUpperCase()) continue;
          expect(linked, `${c.id} « ${a.name} » mentions ${m[0]}`).toContain(m[0]);
        }
      }
  });
});
