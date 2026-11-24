#!/usr/bin/env node
/**
 * Epic 14 retrospective, action 2: game captures for mockups, without editing a dev scene. Against a running dev
 * client (`pnpm dev:client`), opens a dev scene on the portrait phone table and, for each card of my hand, saves:
 *   <n>-<id>-face.png    the card face of the card sheet (`.sheet .card-big`), 14 px transparent margin (cost token)
 *   <n>-<id>-fiche.png   the whole card sheet (`.sheet-body`), close button hidden, no max-height
 *   <n>-<id>-pleine.png  the full card of the detailed hand view (story 14.3, `?handView=detailed`)
 *
 *   node scripts/capture-cards.mjs [--url http://localhost:5173] [--scene pleine] [--dpr 2] [--out test-results/captures]
 *                                  [--width 390] [--height 844]
 *
 * Prints one line per file written.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const URL_ = arg('url', 'http://localhost:5173').replace(/\/$/, '');
const SCENE = arg('scene', 'pleine');
const DPR = Number(arg('dpr', '2'));
const OUT = resolve(arg('out', 'test-results/captures'));
const VIEWPORT = { width: Number(arg('width', '390')), height: Number(arg('height', '844')) };
const MARGIN = 14;

mkdirSync(OUT, { recursive: true });
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const saved = (file) => console.log(relative(process.cwd(), file));

async function openScene(browser, query = '') {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DPR });
  await page.goto(`${URL_}/?scene=${SCENE}${query}`);
  await page.waitForSelector('.table');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForTimeout(1500); // the opening deal settles
  return page;
}
async function openHand(page) {
  const btn = page.locator('.table .hand-btn');
  if ((await btn.count()) && (await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  await page.locator('.table .hand .card').first().waitFor();
}
/** The looping effects are held at their start so every capture shows the same frame. */
const still = (page) =>
  page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      if (a.effect?.getComputedTiming().iterations === Infinity) {
        a.pause();
        a.currentTime = 0;
      } else a.finish();
    }),
  );

/** Screenshots one element alone (everything else hidden) on a transparent background, with a margin around it. */
async function isolated(page, locator, file) {
  const mark = await locator.evaluate((e) => {
    e.setAttribute('data-capture', '');
    return true;
  });
  const style = await page.addStyleTag({
    content: `html, body { background: transparent !important; }
      body * { visibility: hidden !important; }
      [data-capture], [data-capture] * { visibility: visible !important; }`,
  });
  const box = await locator.boundingBox();
  const x = Math.max(0, box.x - MARGIN);
  const y = Math.max(0, box.y - MARGIN);
  const clip = { x, y, width: box.x + box.width + MARGIN - x, height: box.y + box.height + MARGIN - y };
  await page.screenshot({ path: file, clip, omitBackground: true });
  await style.evaluate((e) => e.remove());
  if (mark) await locator.evaluate((e) => e.removeAttribute('data-capture'));
}

const browser = await chromium.launch();
try {
  // (a) card faces and (b) card sheets
  const page = await openScene(browser);
  await openHand(page);
  const names = await page.locator('.table .hand .card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  const files = names.map((name, i) => `${String(i + 1).padStart(2, '0')}-${slug(name) || 'carte'}`);
  for (let i = 0; i < names.length; i++) {
    await openHand(page);
    await page.locator('.table .hand .card').nth(i).click();
    const face = page.locator('.sheet .card-big');
    await face.waitFor();
    await page.waitForTimeout(400);
    await still(page);

    // the face alone, on a transparent background
    let file = join(OUT, `${files[i]}-face.png`);
    await isolated(page, face, file);
    saved(file);

    // the whole sheet, uncut
    const sheetStyle = await page.addStyleTag({ content: `.sheet-body { max-height: none !important; } .sheet-body .sheet-close { visibility: hidden !important; }` });
    await page.waitForTimeout(100);
    file = join(OUT, `${files[i]}-fiche.png`);
    await page.locator('.sheet .sheet-body').screenshot({ path: file });
    saved(file);
    await sheetStyle.evaluate((e) => e.remove());

    await page.locator('.sheet .sheet-close').click();
    await page.locator('.sheet').waitFor({ state: 'detached' });
  }
  await page.close();

  // (c) full cards of the detailed hand view
  const detailed = await openScene(browser, '&handView=detailed');
  await openHand(detailed);
  const full = detailed.locator('.table .hand .card-full');
  const n = await full.count();
  for (let i = 0; i < n; i++) {
    // instant scroll (the row scrolls smoothly), the card centred in the row
    await full.nth(i).evaluate((e) => e.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' }));
    await detailed.waitForTimeout(400);
    await still(detailed);
    const name = (await full.nth(i).getAttribute('aria-label')) ?? '';
    const file = join(OUT, `${String(i + 1).padStart(2, '0')}-${slug(name) || 'carte'}-pleine.png`);
    await isolated(detailed, full.nth(i), file);
    saved(file);
  }
} finally {
  await browser.close();
}
