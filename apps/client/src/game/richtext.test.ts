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
    expect(kinds('Arthur a la hâte.').map((s) => s.kind === 'keyword' && s.term)).toEqual(['Hâte']);
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
