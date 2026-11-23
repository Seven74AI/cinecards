import { buildCatalog, parseSet, type Card } from '@cinecards/cards';
import { playableCardIds, type Catalog } from '@cinecards/engine';

/** Card data and art are bundled by Vite from the repository `content/` folder. */
const rawSets = import.meta.glob('../../../../content/sets/*.json', { eager: true, import: 'default' });
const art = import.meta.glob('../../../../content/art/**/*.{jpg,png,svg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const sets = Object.entries(rawSets).map(([file, json]) => ({ set: parseSet(json, file), file }));
export const SET_TITLES: Record<string, string> = Object.fromEntries(sets.map(({ set }) => [set.id, set.title]));
/** Short film names ("Sacré Graal", "White Chicks"), for tight places such as the deck builder (story 10.2). */
export const SET_FAMILIES: Record<string, string> = Object.fromEntries(sets.map(({ set }) => [set.id, set.family]));
export const CATALOG: Catalog = buildCatalog(sets);
export const PLAYABLE = playableCardIds(CATALOG);

const artByName = new Map(Object.entries(art).map(([path, url]) => [path.split('/content/art/')[1]!, url]));

const ROLE_FILE: Record<string, string> = { héros: 'heros', heros: 'heros', guerrier: 'guerrier', boss: 'boss', soutien: 'soutien', traqueur: 'traqueur', sort: 'sort', terrain: 'terrain' };

/** Picture for a card: its own illustration when we have one, else the emblem of its set and role. */
export function cardArt(card: Card): string | undefined {
  const own = artByName.get(`${card.set}/${card.id}.jpg`) ?? (card.image ? artByName.get(card.image) : undefined);
  if (own) return own;
  const roleKey = card.category === 'spell' || card.category === 'equipment' ? 'sort' : card.category === 'terrain' ? 'terrain' : ROLE_FILE[card.role.split('/')[0]!] ?? 'guerrier';
  return artByName.get(`emblems/${card.set}--${roleKey}.svg`);
}
