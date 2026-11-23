import { expect, test } from '@playwright/test';

/**
 * Story 14.5 (Root's iPhone): with `viewport-fit=cover` the phone table must keep clear of the notch and of the home
 * indicator / Safari bottom bar. Chromium reports no safe area, so the insets are faked with typical iPhone values.
 */
for (const size of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test(`phone table at ${size.width}×${size.height} keeps clear of the safe areas`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/?scene=pleine');
    await page.locator('.table.compact').evaluate((e: HTMLElement) => {
      e.style.setProperty('--sa-t', '47px');
      e.style.setProperty('--sa-b', '34px');
    });
    const m = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const heroes = [...document.querySelectorAll('.table .hero')].map((e) => e.getBoundingClientRect());
      return {
        h: innerHeight,
        top: r('.table .topbar').top,
        myBanner: heroes[1]!.bottom,
        handBtn: r('.table .hand-btn').bottom,
        scroll: document.documentElement.scrollHeight - innerHeight,
      };
    });
    expect(m.top).toBeGreaterThanOrEqual(47 - 1);
    expect(m.myBanner).toBeLessThanOrEqual(m.h - 34 + 1);
    expect(m.handBtn).toBeLessThanOrEqual(m.h - 34 + 1);
    expect(m.scroll).toBeLessThanOrEqual(0);
  });
}
