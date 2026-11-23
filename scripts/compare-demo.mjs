#!/usr/bin/env node
/**
 * Story 13.6: visual proof that the phone table plays like the approved demo (docs/design/animations/demo.html).
 * For three actions (a lethal attack, playing a character, casting a spell) it films the demo and the game at
 * 390 × 844 and builds a contact sheet: one frame every 100 ms, demo on the left, game on the right.
 *
 *   pnpm dev:client                                   # or any vite dev server of apps/client
 *   node scripts/compare-demo.mjs [--url http://localhost:5173] [--out ./compare] [--ms 3000]
 *
 * Writes <out>/<scene>.png (the sheet) for scene = attaque-mortelle, pose-personnage, sort, and (story 13.10)
 * mise-en-avant, carte-retiree (longer scenes: one frame every 250 ms over 8 or 11 s). Dev scenes only
 * (`?scene=...`), so it needs the dev server, not a production build.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Story 14.2: the phone table folds my hand behind the fan button of my banner; opens it. */
async function openHand(p) {
  const btn = p.locator('.table .hand-btn');
  if ((await btn.count()) && (await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const URL_GAME = arg('url', 'http://localhost:5173');
const OUT = resolve(arg('out', join(root, 'compare')));
const SPAN = Number(arg('ms', '3000'));
const STEP = 100;
const VIEW = { width: 390, height: 844 };
const DEMO = pathToFileURL(join(root, 'docs/design/animations/demo.html')).href;
const NI = 'Les Chevaliers qui disent « Ni ! »';

/** Takes screenshots as fast as possible for `span` ms after `start()`; each frame keeps its time (mid-capture). */
async function film(page, start, span = SPAN, step = STEP) {
  const frames = [];
  await start();
  const t0 = Date.now();
  while (Date.now() - t0 < span + step) {
    const a = Date.now();
    const png = await page.screenshot({ animations: 'allow' });
    frames.push({ t: (a + Date.now()) / 2 - t0, png });
  }
  // one frame every STEP ms: the closest capture
  const out = [];
  for (let t = 0; t <= span; t += step) {
    let best = frames[0];
    for (const f of frames) if (Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
    out.push({ t, png: best.png });
  }
  return out;
}

/** The demo, stage at scale 1 in the top left corner of a 390 × 844 page. */
async function demoPage(browser) {
  const page = await browser.newPage({ viewport: VIEW });
  await page.goto(DEMO);
  await page.addStyleTag({
    content: 'body{margin:0!important;padding:0!important} .wrap{padding:0!important;margin:0!important;display:block!important;max-width:none!important} .wrap>.side{display:none!important} .stagebox{max-width:390px!important;width:390px!important}',
  });
  await page.waitForTimeout(300);
  return page;
}

async function gamePage(browser, scene) {
  const page = await browser.newPage({ viewport: VIEW });
  await page.goto(`${URL_GAME}/?scene=${scene}`);
  await page.waitForSelector('.table');
  // let the opening animations (turn banner, glows) end
  await page.waitForTimeout(2500);
  return page;
}

const SCENES = [
  {
    name: 'attaque-mortelle',
    title: 'Attaque mortelle : Topper Harley achève les Chevaliers « Ni ! »',
    demo: (p) => p.evaluate(() => document.getElementById('s5').click()),
    game: {
      scene: 'mort',
      prepare: async (p) => {
        await p.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
        await p.getByRole('button', { name: 'Choisir une cible' }).click();
        await p.waitForTimeout(500);
      },
      start: (p) => p.locator('.board.theirs').getByRole('button', { name: NI }).click(),
    },
  },
  {
    name: 'pose-personnage',
    title: 'Pose d’un personnage depuis la main',
    demo: (p) => p.evaluate(() => document.getElementById('s1').click()),
    game: {
      scene: 'mort',
      prepare: async (p) => {
        await openHand(p);
        await p.locator('.hand .card').first().press('Enter');
        await p.waitForTimeout(500);
      },
      start: (p) => p.getByRole('button', { name: /^Jouer/ }).first().click(),
    },
  },
  {
    name: 'sort',
    title: 'Sort : le missile à tête chercheuse',
    demo: (p) => p.evaluate(() => document.getElementById('s4').click()),
    game: {
      scene: 'pose',
      prepare: async (p) => {
        await openHand(p);
        await openHand(p);
      await p.locator('.hand .card[aria-label^="Missile"]').press('Enter');
        await p.waitForTimeout(500);
      },
      start: (p) => p.getByRole('button', { name: /^Jouer/ }).first().click(),
    },
  },
  {
    // story 13.10: the demo shows Le Grimoire's spell, the game my own (same spotlight, "Vous jouez un sort")
    name: 'mise-en-avant',
    title: 'Mise en avant : le missile à tête chercheuse en grand, avec son effet pendant 3 s',
    span: 8000,
    step: 250,
    demo: (p) => p.evaluate(() => document.getElementById('s6').click()),
    game: {
      scene: 'pose',
      prepare: async (p) => {
        await openHand(p);
        await openHand(p);
      await p.locator('.hand .card[aria-label^="Missile"]').press('Enter');
        await p.waitForTimeout(500);
      },
      start: (p) => p.getByRole('button', { name: /^Jouer/ }).first().click(),
    },
  },
  {
    // the game's film starts when Le Grimoire's spotlight appears (after its turn banner and draw)
    name: 'carte-retiree',
    title: 'Carte retirée : Tank renvoie Lancelot dans la main (mise en avant, tampon, socle, alerte)',
    span: 11000,
    step: 250,
    demo: (p) => p.evaluate(() => document.getElementById('s7').click()),
    game: {
      scene: 'retrait',
      prepare: async () => {},
      start: async (p) => {
        await p.getByRole('button', { name: /Fin du tour/i }).click();
        await p.waitForSelector('.fx-spot', { timeout: 20000 });
      },
    },
  },
];

/** Lays the frames out in an HTML page (pairs demo | game, 4 pairs a row) and screenshots it. */
async function sheet(browser, title, demo, game, file, step = STEP) {
  const scale = 0.5;
  const w = VIEW.width * scale;
  const h = VIEW.height * scale;
  const src = (png) => `data:image/png;base64,${png.toString('base64')}`;
  const cells = demo
    .map(
      (d, i) =>
        `<figure><figcaption>${d.t} ms</figcaption><div><img src="${src(d.png)}"><img src="${src(game[i].png)}"></div></figure>`,
    )
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:12px;background:#111;color:#eee;font:14px system-ui,sans-serif}
    h1{font-size:18px;margin:0 0 4px} p{margin:0 0 10px;color:#aaa}
    main{display:grid;grid-template-columns:repeat(4,${2 * w + 6}px);gap:12px}
    figure{margin:0} figcaption{font-weight:700;margin-bottom:2px}
    figure div{display:flex;gap:6px} img{width:${w}px;height:${h}px;display:block;outline:1px solid #444}
    img+img{outline-color:#4fd1c5}
  </style><h1>${title}</h1><p>Gauche : démo validée (scène sur 390 × 720). Droite (cadre turquoise) : le jeu, 390 × 844. Une image toutes les ${step} ms.</p><main>${cells}</main>`;
  const page = await browser.newPage({ viewport: { width: 4 * (2 * w + 6) + 3 * 12 + 24, height: 600 } });
  await page.setContent(html);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chromium' });
const only = arg('scene', '');
for (const s of SCENES) {
  if (only && s.name !== only) continue;
  const d = await demoPage(browser);
  const demo = await film(d, () => s.demo(d), s.span, s.step);
  await d.close();
  const g = await gamePage(browser, s.game.scene);
  await s.game.prepare(g);
  const game = await film(g, () => s.game.start(g), s.span, s.step);
  if (process.argv.includes('--frames')) game.forEach((f) => writeFileSync(join(OUT, `${s.name}-game-${String(f.t).padStart(4, '0')}.png`), f.png));
  await g.close();
  const file = join(OUT, `${s.name}.png`);
  await sheet(browser, s.title, demo, game, file, s.step);
  console.log(file);
}
await browser.close();
