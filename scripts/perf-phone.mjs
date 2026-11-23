#!/usr/bin/env node
/**
 * Story 13.12: frame times of the phone table during two actions, in iPhone emulation (iPhone 13: 390 × 664,
 * device pixel ratio 3, touch). Chromium runs with its processor slowed ×4 (CDP `Emulation.setCPUThrottlingRate`),
 * WebKit runs once without slowdown (no CDP there). The frames are timed in the page with requestAnimationFrame.
 *
 *   pnpm dev:client                                   # or any vite dev server of apps/client (dev scenes only)
 *   node scripts/perf-phone.mjs [--url http://localhost:5173] [--engine chromium|webkit|all] [--runs 3]
 *                               [--throttle 4] [--scene mort|pose] [--label after] [--out perf.json] [--css '...']
 *
 * Scenes:
 *   mort  `?scene=mort`: Topper Harley attacks Les Chevaliers « Ni ! » and kills them (lunge, impact, death, ashes)
 *   pose  `?scene=pose`: I cast the homing missile from my hand (flight, spotlight with its veil, orb, impact)
 *   repos `?scene=mort` at rest: nothing is played, only the ambient effects run
 * For each run: average FPS over the measured window, the worst frame, frames over 50 ms and over 34 ms.
 */
import { chromium, devices, webkit } from '@playwright/test';
import { writeFileSync } from 'node:fs';

/** Story 14.2: the phone table folds my hand behind the fan button of my banner; opens it. */
async function openHand(p) {
  const btn = p.locator('.table .hand-btn');
  if ((await btn.count()) && (await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
}

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const URL_GAME = arg('url', 'http://localhost:5173');
const RUNS = Number(arg('runs', '3'));
const THROTTLE = Number(arg('throttle', '4'));
const ENGINE = arg('engine', 'all');
const LABEL = arg('label', '');
const OUT = arg('out', '');
const ONLY = arg('scene', '');
/** Investigation aid: a style sheet added to the page before the action (e.g. to switch an effect off). */
const CSS = arg('css', '');
const DPR = Number(arg('dpr', String(devices['iPhone 13'].deviceScaleFactor)));
const DEVICE = devices['iPhone 13'];
const NI = 'Les Chevaliers qui disent « Ni ! »';

const SCENES = [
  {
    name: 'mort',
    title: 'Attaque mortelle',
    ms: 3500,
    prepare: async (p) => {
      await p.locator('.board.mine').getByRole('button', { name: 'Topper Harley' }).click();
      await p.getByRole('button', { name: 'Choisir une cible' }).click();
      await p.waitForTimeout(600);
    },
    start: (p) => p.locator('.board.theirs').getByRole('button', { name: NI }).click(),
  },
  {
    name: 'pose',
    title: 'Pose (sort, mise en avant)',
    ms: 6000,
    prepare: async (p) => {
      await openHand(p);
      await p.locator('.hand .card[aria-label^="Missile"]').press('Enter');
      await p.waitForTimeout(600);
    },
    start: (p) => p.getByRole('button', { name: /^Jouer/ }).first().click(),
  },
  {
    // the table at rest (my turn, nothing played): what the ambient effects alone cost
    name: 'repos',
    title: 'Table au repos',
    ms: 3000,
    prepare: async () => {},
    start: async () => {},
    scene: 'mort',
  },
];

/** Records every frame's time with requestAnimationFrame until `window.__perfStop()`. */
const RECORDER = () => {
  const times = [];
  let on = true;
  const tick = (t) => {
    times.push(t);
    if (on) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__perfStop = () => {
    on = false;
    return times;
  };
};

function stats(times) {
  const d = [];
  for (let i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
  const span = times[times.length - 1] - times[0];
  const sorted = [...d].sort((a, b) => a - b);
  return {
    frames: d.length,
    avgFps: Math.round(((d.length * 1000) / span) * 10) / 10,
    worstMs: Math.round(sorted[sorted.length - 1] * 10) / 10,
    p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
    over50: d.filter((x) => x > 50).length,
    over34: d.filter((x) => x > 34).length,
  };
}

async function runOnce(browserType, engine, scene) {
  const browser = await browserType.launch(engine === 'chromium' ? { channel: process.env.PW_CHANNEL ?? 'chromium' } : {});
  const context = await browser.newContext({ ...DEVICE, deviceScaleFactor: DPR });
  const page = await context.newPage();
  await page.goto(`${URL_GAME}/?scene=${scene.scene ?? scene.name}`);
  await page.waitForSelector('.table.compact');
  // let the opening animations (turn banner, draw, playable glows) end
  if (CSS) await page.addStyleTag({ content: CSS });
  await page.waitForTimeout(3000);
  await scene.prepare(page);
  if (engine === 'chromium' && THROTTLE > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  }
  await page.evaluate(RECORDER);
  await scene.start(page);
  await page.waitForTimeout(scene.ms);
  const times = await page.evaluate(() => window.__perfStop());
  await browser.close();
  return stats(times);
}

const engines = [
  ['chromium', chromium],
  ['webkit', webkit],
].filter(([n]) => ENGINE === 'all' || ENGINE === n);
const results = [];
for (const [engine, type] of engines) {
  for (const scene of SCENES) {
    if (ONLY && scene.name !== ONLY) continue;
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await runOnce(type, engine, scene));
    const mean = (k) => Math.round((runs.reduce((s, r) => s + r[k], 0) / runs.length) * 10) / 10;
    const row = {
      label: LABEL,
      engine: engine === 'chromium' ? `chromium (CPU ×${THROTTLE})` : 'webkit',
      scene: scene.name,
      avgFps: mean('avgFps'),
      worstMs: Math.max(...runs.map((r) => r.worstMs)),
      over50: mean('over50'),
      over34: mean('over34'),
      runs,
    };
    results.push(row);
    console.log(`${row.engine.padEnd(20)} ${scene.name.padEnd(5)} avg ${String(row.avgFps).padStart(5)} fps  worst ${String(row.worstMs).padStart(6)} ms  >50 ms ${row.over50}  >34 ms ${row.over34}  (${RUNS} runs)`);
  }
}
if (OUT) writeFileSync(OUT, JSON.stringify({ date: new Date().toISOString(), url: URL_GAME, device: 'iPhone 13', results }, null, 2));
