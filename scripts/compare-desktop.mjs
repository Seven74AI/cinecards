#!/usr/bin/env node
/**
 * Story 13.12: proof that the desktop table looks the same before and after a change. Two builds of the client
 * (dev scenes on: a vite dev server, or `VITE_SCENES=1 vite build` + `vite preview`) are captured in the same
 * states at 1440 × 900 (and a 1024 × 768 tablet), looping animations held at their start, and compared pixel by pixel.
 *
 *   node scripts/compare-desktop.mjs --before http://localhost:5676 --after http://localhost:5675 [--out ./compare-desktop]
 *
 * Prints, for each state, the share of pixels that differ; writes <out>/<state>-{before,after}.png when they do.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const BEFORE = arg('before', 'http://localhost:5676');
const AFTER = arg('after', 'http://localhost:5675');
const OUT = resolve(arg('out', 'compare-desktop'));

const STATES = [
  { name: 'accueil', path: '/', prepare: async () => {} },
  { name: 'table', path: '/?scene=pose', prepare: async () => {} },
  {
    name: 'cibles',
    path: '/?scene=mort',
    prepare: async (p) => {
      await p.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
      await p.getByRole('button', { name: 'Choisir une cible' }).click();
    },
  },
  {
    name: 'fiche',
    path: '/?scene=pose',
    prepare: async (p) => {
      await p.locator('.hand .card[aria-label^="Missile"]').click();
    },
  },
];
const VIEWS = [
  { tag: 'bureau', viewport: { width: 1440, height: 900 } },
  { tag: 'tablette', viewport: { width: 1024, height: 768 } },
];

async function shot(browser, base, state, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(base + state.path);
  await page.waitForSelector(state.path === '/' ? '.home' : '.table');
  await page.waitForTimeout(3000);
  await state.prepare(page);
  await page.waitForTimeout(800);
  // the looping effects (glows, runes, embers) are held at their start, the others at their end, so the two builds
  // are caught at the same moment (Playwright's 'disabled' would drop the loops' own keyframes)
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      if (a.effect?.getComputedTiming().iterations === Infinity) {
        a.pause();
        a.currentTime = 0;
      } else a.finish();
    }),
  );
  await page.waitForTimeout(100);
  // the turn countdown is masked: its seconds depend on when each build was captured
  const png = await page.screenshot({ animations: 'allow', caret: 'hide', mask: [page.locator('.timer')] });
  await page.close();
  return png;
}

/** Share of pixels whose colour differs by more than a small tolerance. */
async function diff(browser, a, b) {
  const page = await browser.newPage();
  const share = await page.evaluate(
    async ([x, y]) => {
      const load = (src) =>
        new Promise((ok) => {
          const im = new Image();
          im.onload = () => ok(im);
          im.src = src;
        });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const px = (im) => {
        const c = document.createElement('canvas');
        c.width = im.width;
        c.height = im.height;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        return g.getImageData(0, 0, im.width, im.height).data;
      };
      const da = px(ia);
      const db = px(ib);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
      return n / (da.length / 4);
    },
    [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`],
  );
  await page.close();
  return share;
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chromium' });
let worst = 0;
for (const v of VIEWS) {
  for (const s of STATES) {
    const a = await shot(browser, BEFORE, s, v.viewport);
    const b = await shot(browser, AFTER, s, v.viewport);
    const d = await diff(browser, a, b);
    worst = Math.max(worst, d);
    const name = `${v.tag}-${s.name}`;
    console.log(`${name.padEnd(18)} ${(d * 100).toFixed(3)} % of pixels differ`);
    if (d > 0) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, `${name}-before.png`), a);
      writeFileSync(join(OUT, `${name}-after.png`), b);
    }
  }
}
await browser.close();
process.exitCode = worst > 0.001 ? 1 : 0;
