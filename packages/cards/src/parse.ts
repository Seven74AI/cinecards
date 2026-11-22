import { CardSetSchema, type Card, type CardSet } from './schema.ts';

export class CardDataError extends Error {
  constructor(
    public readonly file: string,
    public readonly issues: { card?: string; path: string; message: string }[],
  ) {
    super(`Invalid card data in ${file}:\n` + issues.map((i) => `  - ${i.card ?? '(set)'} › ${i.path}: ${i.message}`).join('\n'));
    this.name = 'CardDataError';
  }
}

/** Validates one set (pure; usable in browser and Node). */
export function parseSet(raw: unknown, file = '(inline)'): CardSet {
  const res = CardSetSchema.safeParse(raw);
  if (res.success) return res.data;
  const cards = (raw as { cards?: { id?: string }[] })?.cards ?? [];
  throw new CardDataError(
    file,
    res.error.issues.map((iss) => {
      const [first, idx, ...rest] = iss.path;
      const card = first === 'cards' && typeof idx === 'number' ? (cards[idx]?.id ?? `#${idx}`) : undefined;
      return { card, path: (card ? rest : iss.path).join('.') || '(root)', message: iss.message };
    }),
  );
}

/** Merges sets into one catalog and checks that card ids are unique across sets. */
export function buildCatalog(sets: { set: CardSet; file: string }[]): Map<string, Card> {
  const catalog = new Map<string, Card>();
  for (const { set, file } of sets) {
    for (const card of set.cards) {
      if (catalog.has(card.id)) throw new CardDataError(file, [{ card: card.id, path: 'id', message: 'duplicate card id' }]);
      catalog.set(card.id, card);
    }
  }
  return catalog;
}
