/**
 * Story 14.6: the open hand of the compact table is one row that scrolls sideways; a card that arrives in it (draw,
 * back to hand) may land past its right edge. `revealInRow` scrolls the row just enough to show that card whole,
 * smoothly unless the player asked for reduced motion.
 *
 * A smooth scroll takes a moment, so the target is remembered while it runs: a second call (the draw animation, which
 * measures the card to fly to it) works from where the row is going, not from where it is.
 */

/** The share of the row hidden by its fading right edge (the mask of `.compact .hand-row`, mobile-table.css). */
const FADE = 0.12;

const going = new WeakMap<HTMLElement, number>();

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scrolls the hand row holding `card` so the card is whole in view. Returns the horizontal distance the card still
 * has to move on screen once the scroll ends (0 when the row is already there or jumped at once), so the caller can
 * aim at where the card will be.
 */
export function revealInRow(card: HTMLElement): number {
  const row = card.closest<HTMLElement>('.hand-row');
  if (!row || row.scrollWidth <= row.clientWidth + 1) return 0;
  const cs = getComputedStyle(row);
  const padL = parseFloat(cs.scrollPaddingLeft) || parseFloat(cs.paddingLeft) || 0;
  const rowLeft = row.getBoundingClientRect().left;
  // positions in the row's content, which do not change while it scrolls
  const at = (el: Element) => el.getBoundingClientRect().left - rowLeft + row.scrollLeft;
  const x0 = at(card);
  const x1 = x0 + card.getBoundingClientRect().width;
  const from = going.get(row) ?? row.scrollLeft;
  const seen = row.clientWidth * (1 - FADE);
  const max = row.scrollWidth - row.clientWidth;
  let to = from;
  if (x0 < from + padL - 0.5) to = x0 - padL;
  else if (x1 > from + seen + 0.5) {
    // the least scroll that shows the card, on a card's start (the row snaps to them), never past the card itself
    const need = x1 - seen;
    const starts = [...row.children].map((c) => at(c) - padL).filter((s) => s >= need - 0.5 && s <= x0 - padL + 0.5);
    to = starts.length ? Math.min(...starts) : x0 - padL;
  }
  to = Math.round(Math.max(0, Math.min(max, to)));
  if (Math.abs(to - row.scrollLeft) < 1) {
    going.delete(row);
    return 0;
  }
  row.scrollTo({ left: to, behavior: reduced() ? 'auto' : 'smooth' });
  if (Math.abs(row.scrollLeft - to) >= 1) {
    going.set(row, to);
    const done = () => {
      if (going.get(row) === to) going.delete(row);
    };
    row.addEventListener('scrollend', done, { once: true });
    setTimeout(done, 1200);
  }
  return row.scrollLeft - to;
}
