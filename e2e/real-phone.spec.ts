import { expect, test, type Page } from '@playwright/test';
import { openHand } from './hand.ts';

/**
 * Epic 14 retrospective, action 4: the phone table on a real iPhone. A 390 × 844 iPhone shows only 390 × 664 in
 * Safari with its bars, and its notch and home indicator take the safe areas (faked as in safe-area.spec.ts: Chromium
 * reports none). At that size: no vertical scroll, both banners and the fan button whole on screen, the open hand
 * (compact and detailed) covers neither banner, and the ATK / PV numbers of the table cards stay visible.
 */
const SAFARI = { width: 390, height: 664 };
const SA_T = 47;
const SA_B = 34;

async function open(page: Page, scene: string, view: 'compact' | 'detailed') {
  await page.setViewportSize(SAFARI);
  await page.addInitScript((v) => {
    try {
      localStorage.setItem('cinecards.handView', v);
    } catch {
      /* private window: the default view */
    }
  }, view);
  await page.goto(`/?scene=${scene}`);
  await expect(page.locator('.table.compact')).toBeVisible();
  await page.locator('.table.compact').evaluate((e: HTMLElement, [t, b]) => {
    e.style.setProperty('--sa-t', `${t}px`);
    e.style.setProperty('--sa-b', `${b}px`);
  }, [SA_T, SA_B]);
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

type Box = { top: number; bottom: number; left: number; right: number };
const layout = (page: Page) =>
  page.evaluate(() => {
    const box = (e: Element | null): Box | null => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return {
      h: innerHeight,
      w: innerWidth,
      scroll: document.documentElement.scrollHeight - innerHeight,
      banners: [...document.querySelectorAll('.table .hero')].map(box) as Box[],
      handBtn: box(document.querySelector('.table .hand-btn')),
      panel: box(document.querySelector('.table .hand-panel')),
    };
  });

/**
 * For each ATK / PV number of a table card: on screen, inside every box that clips it, and clear of the banners, the
 * fan button, the top bar and the other cards (the stats ignore taps, so hit testing cannot tell).
 */
const statsSeen = (page: Page) =>
  page.evaluate(() => {
    const meets = (a: DOMRect, b: DOMRect) => !(a.right <= b.left + 0.5 || a.left >= b.right - 0.5 || a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5);
    const inside = (a: DOMRect, b: DOMRect) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
    return [...document.querySelectorAll('.table .slot .card-stats .badge')].map((b) => {
      const r = b.getBoundingClientRect();
      const card = b.closest('.card')!;
      const clippers: Element[] = [];
      for (let e = b.parentElement; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).overflow !== 'visible') clippers.push(e);
      const others = [...document.querySelectorAll('.table .hero, .table .hand-btn, .table .topbar, .table .slot .card, .table .zplate')].filter(
        (e) => e !== card && !e.contains(card) && !card.contains(e),
      );
      const over = others.find((e) => meets(r, e.getBoundingClientRect()));
      const clip = clippers.find((e) => !inside(r, e.getBoundingClientRect()));
      return {
        card: card.getAttribute('aria-label') ?? '',
        onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        clear: !over && !clip,
        hit: over ? `under ${over.className} ${over.getAttribute('aria-label') ?? ''}` : clip ? `clipped by ${clip.className}` : '',
      };
    });
  });

const meets = (a: Box, b: Box) => !(a.right <= b.left + 0.5 || a.left >= b.right - 0.5 || a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5);

for (const scene of ['pleine', 'mort']) {
  test(`390×664 with safe areas (${scene}): no scroll, banners and fan button on screen, stats visible`, async ({ page }) => {
    await open(page, scene, 'compact');
    await page.waitForTimeout(1500); // the opening deal settles
    const m = await layout(page);
    expect(m.scroll).toBeLessThanOrEqual(0);
    expect(m.banners).toHaveLength(2);
    for (const b of [...m.banners, m.handBtn!]) {
      expect(b.top).toBeGreaterThanOrEqual(SA_T - 1);
      expect(b.bottom).toBeLessThanOrEqual(m.h - SA_B + 1);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(m.w);
    }
    const stats = await statsSeen(page);
    expect(stats.length).toBeGreaterThan(0);
    for (const s of stats) {
      expect(s.onScreen, s.card).toBe(true);
      expect(s.clear, s.card + ' ' + s.hit).toBe(true);
    }
  });
}

for (const view of ['compact', 'detailed'] as const) {
  test(`390×664 with safe areas, ${view} open hand: neither banner covered`, async ({ page }) => {
    await open(page, 'pleine', view);
    await openHand(page);
    await expect(page.locator('.table .hand-panel .card').first()).toBeVisible();
    await expect(page.locator('.table .hand-panel')).toHaveClass(view === 'detailed' ? /detailed/ : /^(?!.*detailed)/);
    await page.waitForTimeout(800);
    const m = await layout(page);
    expect(m.scroll).toBeLessThanOrEqual(0);
    expect(m.panel).not.toBeNull();
    for (const b of m.banners) expect(meets(m.panel!, b), JSON.stringify({ panel: m.panel, banner: b })).toBe(false);
    // the panel itself stays clear of the notch and of the home indicator
    expect(m.panel!.top).toBeGreaterThanOrEqual(SA_T - 1);
    expect(m.panel!.bottom).toBeLessThanOrEqual(m.h - SA_B + 1);
    // the fan button stays on screen to fold the hand again
    expect(m.handBtn!.bottom).toBeLessThanOrEqual(m.h - SA_B + 1);
    // every hand card shows whole from top to bottom, ATK / PV included (the tallest full card, Néo, used to lose them)
    const cut = await page.evaluate(() => {
      const row = document.querySelector('.table .hand-row')!.getBoundingClientRect();
      return [...document.querySelectorAll('.table .hand-row > .card')]
        .filter((c) => {
          const r = c.getBoundingClientRect();
          const stats = c.querySelector('.card-stats')?.getBoundingClientRect();
          return r.top < row.top - 0.5 || r.bottom > row.bottom + 0.5 || (!!stats && stats.bottom > row.bottom + 0.5);
        })
        .map((c) => c.getAttribute('aria-label'));
    });
    expect(cut).toEqual([]);
    await page.locator('.table .hand-btn').click();
    await expect(page.locator('.table .hand-panel')).toHaveCount(0);
  });
}
