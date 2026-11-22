import source from '../../../../_bmad-output/planning-artifacts/glossaire-mots-cles.md?raw';

/**
 * In-game glossary (story 11.8). The single source is Root's validated markdown file, bundled at build time:
 * each "## Section" holding a "| Mot-clé | Texte en jeu |" table becomes a section of the rules screen,
 * and each row a keyword definition. Editing the .md changes the game on the next build.
 */
export interface GlossaryEntry {
  term: string;
  text: string;
}
export interface GlossarySection {
  title: string;
  entries: GlossaryEntry[];
}

export function parseGlossary(md: string): GlossarySection[] {
  const sections: GlossarySection[] = [];
  let current: GlossarySection | null = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      current = { title: h[1]!.trim(), entries: [] };
      sections.push(current);
      continue;
    }
    if (!current || !line.startsWith('|')) continue;
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    if (cells.length < 2 || /^:?-+:?$/.test(cells[0]!) || cells[0] === 'Mot-clé') continue;
    current.entries.push({ term: cells[0]!, text: cells.slice(1).join(' | ') });
  }
  return sections.filter((s) => s.entries.length > 0);
}

export const GLOSSARY: GlossarySection[] = parseGlossary(source);

const norm = (s: string) => s.replace(/’/g, "'").toLowerCase().trim();
const BY_TERM = new Map(GLOSSARY.flatMap((s) => s.entries).map((e) => [norm(e.term), e]));

/** Definition of a glossary term (case and apostrophe insensitive). */
export function definition(term: string): GlossaryEntry | undefined {
  return BY_TERM.get(norm(term));
}

/** "Renvois entre cartes" explanation, if the file still has it (shown on the rules screen). */
export const REFERENCES_NOTE: string[] = (() => {
  const m = /##\s+Renvois entre cartes[^\n]*\n([\s\S]*?)(?=\n##\s|$)/.exec(source);
  if (!m) return [];
  return m[1]!
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).replace(/\*\*/g, ''));
})();
