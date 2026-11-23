/**
 * Story 14.5 (Root, 2026-11-23): the cards I can play come first in my hand, then the others; each group keeps the
 * order the cards were drawn in. A card changes group as soon as it becomes playable or not (coins spent, new turn).
 */
export function sortHand(hand: readonly string[], playable: (iid: string) => boolean): string[] {
  const yes: string[] = [];
  const no: string[] = [];
  for (const iid of hand) (playable(iid) ? yes : no).push(iid);
  return [...yes, ...no];
}
