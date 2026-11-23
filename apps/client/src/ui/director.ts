import type { GameEvent, GameState, PlayerId, Target } from '@cinecards/engine';
import type { Cue } from '../game/playback.ts';
import { animate, animateSteps, cardEl, EASING, ENTRANCE_MS, ENTRANCE_TOUCH, entranceFrames, PHONE_ENTRANCE_MS, PHONE_TEMPO } from './anim.ts';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CardView, CHAINS_SVG, CRACKS_SVG } from './CardView.tsx';
import { iconSvg, STATUS_ICON } from './Icon.tsx';
import { CATALOG, cardArt } from '../game/catalog.ts';
import { abilityBody, abilityTag } from '../game/labels.ts';
import { PHONE_SPELL, REMOVAL, SPOT } from '../game/fx.ts';
import { removalText, STAMP } from '../game/removal.ts';
import { PHONE_FX, particleBudget } from '../game/perf.ts';
import { fxScale, shakeScale, TRAVEL_REF, travelFactor, type TravelKind } from '../game/motion.ts';

/**
 * Epic 12 staging: turns each beat of the playback into Web Animations on the table's DOM, following the
 * approved demo (docs/design/animations/demo.html). Only `transform` and `opacity` move; durations scale
 * with the playback pace (`cue.rate`), and an instant pace (rate 0) never reaches here.
 */

const heroEl = (p: PlayerId) => document.querySelector<HTMLElement>(`.table [data-hero="${p}"]`);
const portraitEl = (p: PlayerId) => heroEl(p)?.querySelector<HTMLElement>('.avatar') ?? heroEl(p);
const targetEl = (t: Target) => (t.kind === 'card' ? cardEl(t.iid) : portraitEl(t.player));
/** A damage/effect target string: a card iid (heroes are hit through `playerDamaged`). */
const elOf = (at: string) => (at.startsWith('hero:') ? portraitEl(Number(at.slice(5)) as PlayerId) : cardEl(at));

const center = (el: Element) => {
  const r = rectOf(el);
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// ---------------------------------------------------------------------------------------------------------
// Story 13.6: on the compact phone table the board cards are 40 to 70 px wide, the demo's are 100 px. The cards
// an action involves (attacker and target, a card landing, a source that fires, a card that dies) are staged:
// scaled up in place to the demo's size (kept on screen), then sent back to their slot once the action is over.
// Only the CSS `scale` / `translate` properties are used, so the effects' own `transform` animations compose.
// Never on the other layouts (landscape, tablet, desktop keep their animations).
// ---------------------------------------------------------------------------------------------------------

/** Width of a staged card: the demo's cards are 100 px wide. */
const STAGE_W = 104;
type Staged = { k: number; tx: number; ty: number; rect: DOMRect; until: number; r: number };
const staged = new Map<HTMLElement, Staged>();
let stageTimer: ReturnType<typeof setTimeout> | undefined;
const compactTable = () => !!document.querySelector('.table.compact');
/** Story 13.11: travel motions take longer on the portrait phone table (`PHONE_TEMPO`); impacts and numbers do not. */
const tempo = () => (compactTable() ? PHONE_TEMPO : 1);
/** Story 13.13: a travel over `d` px on screen takes its usual time × this (distance / typical distance, bounded). */
const travelK = (d: number, kind: TravelKind) => travelFactor(d, (compactTable() ? TRAVEL_REF.phone : TRAVEL_REF.desk)[kind]);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
/** Story 13.13: the playback's way to stretch the beat to the measured travel (absent in tests and leads). */
type Retime = ((ms: number) => void) | undefined;

/** Where an element is on screen; a staged card answers with its staged place (also while it grows). */
function rectOf(el: Element): DOMRect {
  return staged.get(el as HTMLElement)?.rect ?? el.getBoundingClientRect();
}
/** The scale a staged card is drawn at: a `transform` on it is applied inside that scale. */
const stageK = (el: Element | null | undefined) => (el ? (staged.get(el as HTMLElement)?.k ?? 1) : 1);

/**
 * Stages a board card for `holdMs` (or keeps it staged that long). `inMs`: how long it takes to grow.
 * Returns the staging, or null when there is nothing to do (other layouts, a card already large enough).
 */
function stage(el: HTMLElement | null | undefined, r: number, holdMs: number, inMs = 160 * r): Staged | null {
  if (!el || !el.classList.contains('card') || !compactTable()) return null;
  const until = performance.now() + holdMs;
  const had = staged.get(el);
  if (had) {
    had.until = Math.max(had.until, until);
    scheduleUnstage();
    return had;
  }
  const b = el.getBoundingClientRect();
  if (!b.width || b.width >= STAGE_W - 1) return null;
  const k = STAGE_W / b.width;
  const w = b.width * k;
  const h = b.height * k;
  const cx = b.left + b.width / 2;
  const cy = b.top + b.height / 2;
  const nx = Math.min(innerWidth - w / 2 - 4, Math.max(w / 2 + 4, cx));
  const ny = Math.min(innerHeight - h / 2 - 4, Math.max(h / 2 + 4, cy));
  const st: Staged = { k, tx: nx - cx, ty: ny - cy, rect: new DOMRect(nx - w / 2, ny - h / 2, w, h), until, r };
  el.style.scale = String(k);
  el.style.translate = `${st.tx}px ${st.ty}px`;
  el.style.zIndex = '30';
  void animate(el, [{ scale: '1', translate: '0px 0px' }, { scale: String(k), translate: `${st.tx}px ${st.ty}px` }], inMs, { easing: EASING.easeOut });
  staged.set(el, st);
  scheduleUnstage();
  return st;
}

function scheduleUnstage() {
  clearTimeout(stageTimer);
  if (!staged.size) return;
  const next = Math.min(...[...staged.values()].map((s) => s.until));
  stageTimer = setTimeout(unstageDue, Math.max(0, next - performance.now()));
}

/** Staged cards whose time is up go back to their slot. */
function unstageDue() {
  const now = performance.now();
  for (const [el, s] of staged) {
    if (!el.isConnected) {
      staged.delete(el);
      continue;
    }
    if (s.until > now + 5) continue;
    staged.delete(el);
    el.style.scale = '';
    el.style.translate = '';
    void animate(el, [{ scale: String(s.k), translate: `${s.tx}px ${s.ty}px` }, { scale: '1', translate: '0px 0px' }], 280 * s.r, { easing: EASING.easeInOut }).then(() => {
      if (!staged.has(el)) el.style.zIndex = '';
    });
  }
  scheduleUnstage();
}

/** Effects on a card stage it too, unless several cards are on stage already (an effect on a whole side). */
const stageHit = (el: HTMLElement | null | undefined, r: number, holdMs: number) => (staged.size < 3 || staged.has(el!) ? stage(el, r, holdMs) : null);

/** The attack being played: its riposte is the defender hitting back. */
let current: { attacker: string; target: Target; until: number } | null = null;

/** Elements drawn over the table for a moment (impact star, beam), outside React. */
function overlay(cls: string, x: number, y: number, html = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `fx-layer ${cls}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

const STAR = '<svg viewBox="0 0 64 64" width="64" height="64"><path d="M32 2l6 18 18-8-10 16 18 6-18 6 10 16-18-8-6 18-6-18-18 8 10-16-18-6 18-6-10-16 18 8z" fill="#c0392b" stroke="#fff3d6" stroke-width="1.5"/></svg>';

/** Impact star at the target, scaled with the damage. */
function splat(el: HTMLElement, amount: number, r: number, small = false) {
  const c = center(el);
  // story 13.14: at the scale of the card (a portrait: of a card of this table)
  const size = fxScaleOf(el) * (small ? 0.7 : 1) * Math.min(1.5, 0.8 + amount / 200);
  const s = overlay('fx-splat', c.x, c.y, STAR);
  void animateSteps(
    s,
    [
      { transform: `translate(-50%,-50%) scale(${0.2 * size}) rotate(-20deg)`, opacity: 0, easing: EASING.snap },
      { transform: `translate(-50%,-50%) scale(${1.15 * size}) rotate(5deg)`, opacity: 1, offset: 0.25, easing: EASING.easeOut },
      { transform: `translate(-50%,-50%) scale(${size}) rotate(0)`, opacity: 0.9, offset: 0.6, easing: EASING.easeIn },
      { transform: `translate(-50%,-50%) scale(${1.1 * size})`, opacity: 0 },
    ],
    700 * r,
  ).then(() => s.remove());
}

/** The table shakes in proportion to the damage, and (story 13.15) to the size of the screen. */
export function shake(amount: number, r: number) {
  const p = Math.min(10, 2 + amount / 25) * shakeScale(innerWidth, innerHeight);
  void animateSteps(
    document.querySelector('.table'),
    [{ translate: '0 0' }, { translate: `${p}px ${-p / 2}px` }, { translate: `${-p}px ${p / 2}px` }, { translate: `${p / 2}px 0` }, { translate: '0 0' }],
    320 * r,
    EASING.easeInOut,
    { composite: 'add' },
  );
}

/** Small knock-back of the card or portrait that takes the hit. */
function recoil(el: HTMLElement, from: HTMLElement | null, r: number, power = 1) {
  const a = from ? center(from) : center(el);
  const b = center(el);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const k = 8 * power;
  const dx = ((b.x - a.x) / len) * k;
  const dy = ((b.y - a.y) / len) * k;
  void animateSteps(el, [{ translate: '0 0', rotate: '0deg', easing: EASING.snap }, { translate: `${dx}px ${dy}px`, rotate: `${3 * power}deg`, offset: 0.3, easing: EASING.easeOut }, { translate: '0 0', rotate: '0deg' }], 260 * r, EASING.easeOut, { composite: 'add' });
}

/** Where the dash of an attack ends, from the attacker's centre: the demo's dash on the compact table, else just short. */
function dashTo(att: HTMLElement, tgt: HTMLElement, compact: boolean) {
  const a = center(att);
  const b = center(tgt);
  if (compact) {
    // the demo's dash: all the way across, 78 % of the way up or down, so the staged cards overlap
    return { dx: b.x - a.x, dy: (b.y - a.y) * 0.78 };
  }
  // stop just short of the target (the demo stops at 78 % of a short distance), so the cards touch
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const k = Math.max(0, len - Math.min(len * 0.22, rectOf(tgt).height * 0.45)) / len;
  return { dx: (b.x - a.x) * k, dy: (b.y - a.y) * k };
}

/** Attack: lift, dash at the target (stopping short), then come back once the hit has landed. */
function lunge(att: HTMLElement, tgt: HTMLElement, r: number, retime?: Retime) {
  // story 13.13: the dash and the way back take a time in proportion to the distance; the lift does not
  const pre = dashTo(att, tgt, compactTable());
  const k = travelK(Math.hypot(pre.dx, pre.dy), 'attack');
  const lift = 220 * r * tempo();
  const dash = 170 * r * tempo() * k;
  const back = 380 * r * tempo() * k;
  retime?.(lift + dash);
  // story 13.6: on the compact table attacker and target are staged at the demo's size, the attacker as it lifts
  const sa = stage(att, r, lift + dash + back + 900 * r, lift);
  stage(tgt, r, lift + dash + back + 900 * r, lift);
  let { dx, dy } = dashTo(att, tgt, !!sa || compactTable());
  // a transform on a staged card is drawn inside its stage scale
  const ks = sa?.k ?? 1;
  dx /= ks;
  dy /= ks;
  const lifted = `translate(0,${6 / ks}px) scale(1.12)`;
  att.style.zIndex = '30';
  void animate(
    att,
    [
      { transform: 'translate(0,0) scale(1)', offset: 0, easing: EASING.easeOut },
      { transform: lifted, offset: lift / (lift + dash), easing: EASING.easeIn },
      { transform: `translate(${dx}px,${dy}px) scale(1.05)`, offset: 1 },
    ],
    lift + dash,
    { fill: 'forwards', easing: 'linear' },
  ).then(() => {
    const out = att.getAnimations();
    void animateSteps(
      att,
      [
        { transform: `translate(${dx}px,${dy}px) scale(1.05)`, easing: EASING.snap },
        { transform: `translate(${dx * 0.8}px,${dy * 0.8}px) scale(1.06)`, offset: 0.2, easing: EASING.easeInOut },
        { transform: 'translate(0,0) scale(1)' },
      ],
      back,
    ).then(() => {
      if (!staged.has(att)) att.style.zIndex = '';
    });
    out.forEach((x) => x.cancel());
  });
}

/** Glow of a card whose ability fires. */
function glow(el: HTMLElement, r: number) {
  const g = overlay('fx-glow', 0, 0);
  const rect = rectOf(el);
  g.style.left = `${rect.left}px`;
  g.style.top = `${rect.top}px`;
  g.style.width = `${rect.width}px`;
  g.style.height = `${rect.height}px`;
  void animate(g, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], 700 * r, { easing: 'linear' }).then(() => g.remove());
}

/** Magic beam from the source to the target, no contact. */
function beam(from: HTMLElement, to: HTMLElement, r: number, color = '#b8d4ff', k = 1) {
  const a = center(from);
  const b = center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const bm = overlay('fx-beam', a.x, a.y);
  bm.style.width = `${len}px`;
  bm.style.background = `linear-gradient(90deg, transparent, ${color} 30%, #fff 50%, ${color} 70%, transparent)`;
  bm.style.boxShadow = `0 0 14px 2px ${color}`;
  void animateSteps(
    bm,
    [
      { transform: `rotate(${ang}rad) scaleX(0)`, opacity: 1, easing: EASING.easeOut },
      { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.55, easing: EASING.linear },
      { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 0 },
    ],
    520 * r * tempo() * k,
  ).then(() => bm.remove());
}

/** Targets of the effects that follow a fired ability, up to the next ability or attack. */
function effectTargets(events: GameEvent[], from: number): string[] {
  const out: string[] = [];
  for (let i = from + 1; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'abilityUsed' || e.type === 'attackDeclared' || e.type === 'turnEnded') break;
    const at = e.type === 'damageDealt' || e.type === 'statusApplied' || e.type === 'modified' || e.type === 'healed' ? e.target : e.type === 'playerDamaged' ? `hero:${e.player}` : null;
    if (at && !out.includes(at)) out.push(at);
  }
  return out;
}

/**
 * Story 13.14: the scale effects on `el` are drawn at, from its width on screen (the demo's cards are 100 px wide).
 * A portrait is a small avatar: its effects take the scale of a card of this table (a card, or else an empty slot).
 */
function fxScaleOf(el: Element): number {
  if (el.classList.contains('card')) return fxScale(rectOf(el).width);
  const ref = document.querySelector('.table .board .card') ?? document.querySelector('.table .board .slot');
  return fxScale(ref ? ref.getBoundingClientRect().width : rectOf(el).width);
}
/**
 * Text drawn over a card (numbers, labels) keeps its earlier size so it stays readable (Root, 2026-11-23: story 13.14
 * scales the graphics only): the card's width over 90 px, between 0.6 and 1.2.
 */
const fitOf = (el: Element) => Math.min(1.2, Math.max(0.6, rectOf(el).width / 90));

/** Story 12.3: a number that splashes up from the target; its size follows the value. */
function floatText(x: number, y: number, text: string, color: string, size: number, r: number, cls = '') {
  const t = overlay(`fx-num ${cls}`, x, y);
  t.textContent = text;
  t.style.color = color;
  t.style.fontSize = `${Math.round(size)}px`;
  void animateSteps(
    t,
    [
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0, easing: EASING.overshoot },
      { transform: 'translate(-50%,-70%) scale(1.25)', opacity: 1, offset: 0.2, easing: EASING.easeOut },
      { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.7, easing: EASING.easeIn },
      { transform: 'translate(-50%,-140%) scale(.95)', opacity: 0 },
    ],
    1100 * Math.max(r, 0.5),
  ).then(() => t.remove());
}

/** A colored veil over the card for a moment (the card "turns red" when hit, glows green when healed). */
function tint(el: HTMLElement, cls: string, r: number, ms = 380) {
  const rect = rectOf(el);
  const v = overlay(`fx-tint ${cls}`, rect.left, rect.top);
  v.style.width = `${rect.width}px`;
  v.style.height = `${rect.height}px`;
  void animate(v, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], ms * r).then(() => v.remove());
}

/** Story 13.12: particles on screen right now (the portrait phone table caps them, see `PHONE_FX`). */
let liveParticles = 0;

/** Small particles (poison bubbles, healing sparks, shield shards) rising from the card. */
function particles(el: HTMLElement, n: number, colors: string[], r: number, rise = 50, ms = 700, cls = 'fx-dot') {
  const rect = rectOf(el);
  // story 13.14: particles, their rise and their drift follow the size of the card
  const s = fxScaleOf(el);
  rise *= s;
  const count = particleBudget(n, compactTable(), liveParticles);
  liveParticles += count;
  // on the phone a smaller burst keeps the spread of the full one (every k-th particle of it)
  const every = n / Math.max(1, count);
  for (let j = 0; j < count; j++) {
    const i = Math.floor(j * every);
    const x = rect.left + rect.width * (0.2 + (0.6 * ((i * 37) % 100)) / 100);
    const y = rect.top + rect.height * (0.55 + (0.35 * ((i * 53) % 100)) / 100);
    const d = overlay(cls, x, y);
    d.style.setProperty('--c', colors[i % colors.length]!);
    const dx = (((i * 29) % 21) - 10) * s;
    const up = rise * (0.6 + ((i * 41) % 40) / 100);
    void animateSteps(
      d,
      [
        { transform: `translate(-50%,-50%) scale(${0.4 * s})`, opacity: 0, easing: EASING.snap },
        { transform: `translate(-50%,-50%) scale(${s})`, opacity: 1, offset: 0.2, easing: EASING.easeOut },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${up}px)) scale(${0.6 * s})`, opacity: 0 },
      ],
      ms * r * (0.8 + ((i * 17) % 40) / 100),
      EASING.easeOut,
      { delay: j * 25 * r },
    ).then(() => {
      d.remove();
      liveParticles--;
    });
  }
}

/** Golden arrow up / violet arrow down on the ATK or HP badge, with the value. */
function statArrow(card: HTMLElement, which: 'atk' | 'hp', delta: number, r: number) {
  const badge = card.querySelector<HTMLElement>(`.badge.${which}`) ?? card;
  const c = center(badge);
  const up = delta > 0;
  const color = up ? '#f2d27a' : '#b98cff';
  const path = up ? 'M12 3l8 10h-5v8H9v-8H4z' : 'M12 21l8-10h-5V3H9v8H4z';
  // story 13.14: the arrow at the scale of the card; its value keeps its size (readable)
  const s = fxScaleOf(card);
  const icon = Math.round(Math.max(12, 22 * s));
  const a = overlay('fx-arrow', c.x, c.y - 16 * s, `<svg viewBox="0 0 24 24" width="${icon}" height="${icon}" aria-hidden="true"><path d="${path}" fill="${color}" stroke="#2a1a0e" stroke-width="1.2"/></svg><b style="color:${color}">${up ? '+' : '−'}${Math.abs(delta)}</b>`);
  void animateSteps(
    a,
    [
      { transform: `translate(-50%,${up ? '-10%' : '-90%'})`, opacity: 0, easing: EASING.overshoot },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.3, easing: EASING.linear },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.7, easing: EASING.easeIn },
      { transform: `translate(-50%,${up ? '-140%' : '40%'})`, opacity: 0 },
    ],
    900 * Math.max(r, 0.5),
  ).then(() => a.remove());
}

const SHIELD =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="rgba(242,210,122,.35)" stroke="#f2d27a" stroke-width="1.4"/></svg>';
const CRACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l-1.5 5 3 3-3.5 4 2 3-1 4M13.5 11l4 1M10 15l-4 .5" fill="none" stroke="#fff3d6" stroke-width="1.1" stroke-linecap="round"/></svg>';

/** The shield takes the hit: it cracks, and shatters if it is used up. */
function shieldHit(card: HTMLElement, absorbed: number, broken: boolean, r: number) {
  const c = center(card);
  const size = rectOf(card).width * 0.8;
  const box = (html: string) => {
    const el = overlay('fx-shield', c.x, c.y, html);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    return el;
  };
  const shield = box(SHIELD);
  const crack = box(CRACK);
  const total = (broken ? 700 : 600) * r;
  void animateSteps(
    shield,
    [
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0, easing: EASING.snap },
      { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: 0.25, easing: EASING.easeOut },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.6, easing: EASING.easeIn },
      { transform: `translate(-50%,-50%) scale(${broken ? 1.3 : 1})`, opacity: 0 },
    ],
    total,
  ).then(() => shield.remove());
  void animateSteps(
    crack,
    [
      { transform: 'translate(-50%,-50%)', opacity: 0 },
      { transform: 'translate(-50%,-50%)', opacity: 0, offset: 0.25 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.75 },
      { transform: 'translate(-50%,-50%)', opacity: 0 },
    ],
    total,
    EASING.linear,
  ).then(() => crack.remove());
  if (broken) particles(card, 10, ['#f2d27a', '#fff3d6'], r, 30, 600, 'fx-shard');
  floatText(c.x, c.y + size * 0.35, `absorbé ${absorbed}`, '#c9c2b4', 12 * fitOf(card), r, 'small');
}

/** Each status lands with its own effect: chains for silence, bubbles for poison, a shield, or its icon. */
function statusFx(card: HTMLElement, kind: string, r: number) {
  const meta = STATUS_ICON[kind];
  const c = center(card);
  const rect = rectOf(card);
  const land = [
    { transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0, easing: EASING.easeIn },
    { transform: 'translate(-50%,-50%) scale(.9)', opacity: 1, offset: 0.55, easing: EASING.easeOut },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.8, easing: EASING.linear },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
  ];
  if (kind === 'silence') {
    const ch = overlay('fx-chains', c.x, c.y, CHAINS_SVG);
    ch.style.width = `${rect.width}px`;
    ch.style.height = `${rect.height}px`;
    void animateSteps(ch, land, 650 * r).then(() => ch.remove());
  } else if (kind === 'poison') {
    particles(card, 12, ['#8fe36a', '#4fbf3a', '#c6f5a8'], r, 60, 800, 'fx-bubble');
  } else {
    const shield = kind === 'shield';
    const ic = overlay('fx-status', c.x, c.y, shield ? SHIELD : iconSvg(meta?.icon ?? 'star', Math.round(rect.width * 0.5), meta?.color ?? '#f2d27a'));
    if (shield) {
      ic.style.width = `${rect.width * 0.8}px`;
      ic.style.height = `${rect.width * 0.8}px`;
    }
    void animateSteps(ic, land, 650 * r).then(() => ic.remove());
  }
  if (meta) floatText(c.x, rect.top + rect.height * 0.25, meta.label, meta.color, 13 * fitOf(card), r, 'small');
}

const later = (fn: () => void, ms: number) => setTimeout(fn, ms);


/** The graveyard counter of a player, where the ashes go. */
const graveEl = (p: PlayerId) => heroEl(p)?.querySelector<HTMLElement>('[title="Cimetière"]') ?? heroEl(p);

/**
 * Story 12.4, death (demo scene "Mort"): the card freezes, cracks, shakes, then burns away in place
 * (scorch veil, embers); its ashes fly in an arc to its owner's graveyard counter, which glows.
 * `ms` is the whole time the card stays in its slot.
 */
function death(iid: string, owner: PlayerId, ms: number, r: number) {
  const card = cardEl(iid);
  if (!card) return;
  void animate(
    card,
    [
      { transform: 'none', opacity: 1, offset: 0, easing: EASING.linear },
      { transform: 'none', opacity: 1, offset: 0.25, easing: EASING.easeInOut },
      { transform: 'rotate(-2deg)', opacity: 1, offset: 0.33, easing: EASING.easeInOut },
      { transform: 'rotate(2deg)', opacity: 1, offset: 0.4, easing: EASING.easeInOut },
      { transform: 'rotate(0) scale(1)', opacity: 1, offset: 0.46, easing: EASING.easeOut },
      { transform: 'scale(.96)', opacity: 1, offset: 0.7, easing: EASING.easeIn },
      { transform: 'scale(.88) translateY(6px)', opacity: 0, offset: 1 },
    ],
    ms,
    { fill: 'forwards', easing: 'linear' },
  );
  void animate(card.querySelector('.cracks'), [{ opacity: 0 }, { opacity: 0, offset: 0.08 }, { opacity: 1, offset: 0.25 }, { opacity: 1 }], ms, { fill: 'forwards', easing: 'linear' });
  void animate(card.querySelector('.scorch'), [{ opacity: 0 }, { opacity: 0, offset: 0.46 }, { opacity: 0.7, offset: 0.75 }, { opacity: 1 }], ms, { fill: 'forwards', easing: 'linear' });
  const rect = rectOf(card);
  const ash = fxScaleOf(card); // story 13.14: ashes at the scale of the card
  later(() => particles(card, 18, ['#ff8a3d', '#ffd27a', '#8e1f1f'], r, 70, 900), ms * 0.46);
  // ashes: from where the card was to the graveyard counter
  later(() => {
    const g = graveEl(owner);
    if (!g) return;
    const to = center(g);
    const n = compactTable() ? PHONE_FX.ashes : 12;
    let left = n;
    for (let i = 0; i < n; i++) {
      const x = rect.left + rect.width * (0.2 + (0.6 * ((i * 37) % 100)) / 100);
      const y = rect.top + rect.height * (0.2 + (0.6 * ((i * 53) % 100)) / 100);
      const d = overlay('fx-ash', x, y);
      const dx = to.x - x;
      const dy = to.y - y;
      // story 13.13: ashes going further fly longer
      const k = travelK(Math.hypot(dx, dy), 'effect');
      void animateSteps(
        d,
        [
          { transform: `translate(-50%,-50%) scale(${ash})`, opacity: 0.9, easing: EASING.easeOut },
          { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(${ash})`, opacity: 0.8, offset: 0.5, easing: EASING.easeIn },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${0.5 * ash})`, opacity: 0 },
        ],
        (700 + i * 40) * Math.max(r, 0.5) * k,
      ).then(() => {
        d.remove();
        if (--left === 0) void animateSteps(g, [{ transform: 'scale(1)', easing: EASING.overshoot }, { transform: 'scale(1.35)', offset: 0.4, easing: EASING.easeInOut }, { transform: 'scale(1)' }], 600 * Math.max(r, 0.5));
      });
    }
  }, ms * 0.9);
}

/** Story 12.4, death avoided: the card cracks, shakes, then the crack seals in a golden glint, "Sauvé !". */
function saved(iid: string, ms: number, r: number) {
  const card = cardEl(iid);
  if (!card) return;
  const rect = rectOf(card);
  const cr = overlay('fx-crack', rect.left, rect.top, CRACKS_SVG);
  cr.style.width = `${rect.width}px`;
  cr.style.height = `${rect.height}px`;
  void animate(cr, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], ms, { easing: 'linear' }).then(() => cr.remove());
  void animateSteps(card, [{ rotate: '0deg', easing: EASING.easeInOut }, { rotate: '-2deg', offset: 0.3 }, { rotate: '2deg', offset: 0.4 }, { rotate: '0deg', offset: 0.5, easing: EASING.linear }, { rotate: '0deg' }], ms, EASING.easeInOut, { composite: 'add' });
  later(() => {
    tint(card, 'saved', r, 450);
    particles(card, 10, ['#f2d27a', '#fff4c4'], r, 40, 600);
    const c = center(card);
    floatText(c.x, c.y - 10, 'Sauvé !', '#f2d27a', 16 * fitOf(card), r, 'small');
  }, ms * 0.5);
}

/** Story 12.4, back to hand: the card lifts and flies in an arc to its owner's hand, shrinking. */
function backToHand(iid: string, owner: PlayerId, ms: number, retime?: Retime) {
  const card = cardEl(iid);
  const mine = !!card?.closest('.board.mine');
  // the compact table (story 13.2) has no row of card backs: the foe's cards fly to the hand counter of their hero;
  // story 14.2: mine fly to my open hand, or to the fan button while my hand is folded
  const hand = (mine ? myHand() : document.querySelector<HTMLElement>('.table .foe-hand')) ?? heroEl(owner)?.querySelector<HTMLElement>('[title="Main"]') ?? null;
  if (!card || !hand) return;
  const a = center(card);
  const b = center(hand);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // story 13.13: the flight takes a time in proportion to the distance; the card leaves its slot when it lands
  const k = travelK(Math.hypot(dx, dy), 'fly');
  ms *= k;
  retime?.(ms + 16);
  card.style.zIndex = '30';
  void animate(
    card,
    [
      { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1, easing: EASING.easeOut },
      { transform: 'translate(0,-14px) scale(1.12) rotate(0)', opacity: 1, offset: 0.25, easing: EASING.easeInOut },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) scale(.9) rotate(${owner ? -8 : 8}deg)`, opacity: 1, offset: 0.6, easing: EASING.easeIn },
      { transform: `translate(${dx}px, ${dy}px) scale(.55) rotate(0)`, opacity: 0.2 },
    ],
    ms,
    { fill: 'forwards', easing: 'linear' },
  );
  if (mine) later(() => popBadge(1), ms);
}

// ---------------------------------------------------------------------------------------------------------
// Story 12.5: cards travel. Hand → slot (arc, grows over the slot, lands with an effect of its category),
// deck → hand (a card back slides, then turns over), and summons from their zone of origin.
// ---------------------------------------------------------------------------------------------------------

type Pt = { x: number; y: number; w: number };
const ptOf = (el: Element | null | undefined): Pt | null => {
  const r = el ? rectOf(el) : undefined;
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null;
};

/** Where each card of my hand was lately: the hand follows the real state, so a played card has left it already. */
const handSeen = new Map<string, { pt: Pt; at: number }>();
export function noteHand() {
  const now = performance.now();
  document.querySelectorAll<HTMLElement>('.table .hand .card[data-iid]').forEach((el) => {
    const pt = ptOf(el);
    if (pt) handSeen.set(el.dataset.iid!, { pt, at: now });
  });
  for (const [k, v] of handSeen) if (now - v.at > 20000) handSeen.delete(k);
}

/** The player at the bottom of the table (the last hero). */
const myId = (): PlayerId => {
  const heroes = document.querySelectorAll<HTMLElement>('.table [data-hero]');
  return Number(heroes[heroes.length - 1]?.dataset.hero ?? 0) as PlayerId;
};
const counterEl = (p: PlayerId, title: 'Pioche' | 'Cimetière' | 'Main') => heroEl(p)?.querySelector<HTMLElement>(`[title="${title}"]`) ?? heroEl(p);
/** My hand: its row, or on the compact table (story 14.2) the open hand panel, else the fan button of my banner. */
const myHand = () => document.querySelector<HTMLElement>('.table .hand') ?? document.querySelector<HTMLElement>('.table .hand-btn');
/** A player's hand on the table: mine, or the foe's row of card backs (on the compact table, their hand counter). */
const handZone = (p: PlayerId): HTMLElement | null =>
  p === myId() ? myHand() : (document.querySelector<HTMLElement>('.table .foe-hand') ?? counterEl(p, 'Main'));
/** Story 14.2: the badge of the folded hand's button pops when a card reaches it. */
function popBadge(r: number) {
  const badge = document.querySelector<HTMLElement>('.table .hand-btn:not(.on) .hand-badge');
  if (!badge) return;
  void animate(badge, [{ transform: 'scale(1)' }, { transform: 'scale(1.5)', offset: 0.35 }, { transform: 'scale(1)' }], 380 * Math.max(r, 0.5), { easing: EASING.easeOut });
}

/** Any card on the table: a character, or a terrain / equipment in its strip. */
const boardEl = (iid: string) => cardEl(iid) ?? document.querySelector<HTMLElement>(`.table .zones [data-iid="${CSS.escape(iid)}"]`);

/** The card flies in an arc from `from`, grows over its place and lands (demo `flyCard`, story 13.11 curves). */
function flyIn(el: HTMLElement, from: Pt, ms: number, tilt = 0) {
  const to = ptOf(el);
  if (!to) return;
  // a staged card (story 13.6) draws its transform inside its stage scale
  const k = stageK(el);
  const dx = (from.x - to.x) / k;
  const dy = (from.y - to.y) / k;
  const s0 = Math.min(2, Math.max(0.3, from.w / to.w));
  el.style.zIndex = '30';
  // story 13.11: a step back, an arc over the slot, then a landing that overshoots a little and settles
  void animate(el, entranceFrames(dx, dy, s0, tilt, k), ms, { easing: 'linear' }).then(() => {
    if (!staged.has(el)) el.style.zIndex = '';
  });
}

/** Character landing: a ring of runes lights up under the card, golden dust, a small thud. */
function runeLanding(el: HTMLElement, r: number) {
  const c = ptOf(el);
  if (!c) return;
  const ring = overlay('fx-rune', c.x, c.y);
  ring.style.width = ring.style.height = `${Math.round(c.w * 1.15)}px`;
  void animateSteps(
    ring,
    [
      { transform: 'translate(-50%,-50%) scale(.6) rotate(0deg)', opacity: 0, easing: EASING.snap },
      { transform: 'translate(-50%,-50%) scale(1.1) rotate(40deg)', opacity: 1, offset: 0.3, easing: EASING.easeOut },
      { transform: 'translate(-50%,-50%) scale(1.4) rotate(90deg)', opacity: 0 },
    ],
    700 * r,
  ).then(() => ring.remove());
  particles(el, 12, ['#f2d27a', '#fff4c4'], r, 30, 600);
  shake(20, r);
}

/** Terrain landing: its seal is stamped, then a green wave spreads from it. */
function sealLanding(el: HTMLElement, r: number) {
  const c = ptOf(el);
  if (!c) return;
  const size = Math.max(28, c.w);
  const seal = overlay('fx-seal', c.x, c.y);
  seal.style.width = seal.style.height = `${size}px`;
  void animateSteps(
    seal,
    [
      { transform: 'translate(-50%,-50%) scale(2.2)', opacity: 0, easing: EASING.easeIn },
      { transform: 'translate(-50%,-50%) scale(.9)', opacity: 1, offset: 0.45, easing: EASING.overshoot },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.65, easing: EASING.linear },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
    ],
    650 * r,
  ).then(() => seal.remove());
  const wave = overlay('fx-wave', c.x, c.y);
  wave.style.width = wave.style.height = `${size}px`;
  void animate(wave, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(6)', opacity: 0 }], 800 * r, { delay: 260 * r, easing: EASING.easeOut }).then(() => wave.remove());
}

/** Equipment landing: it locks onto the rune stone with a metallic glint. */
function metalLanding(el: HTMLElement, r: number) {
  const rect = rectOf(el);
  const g = overlay('fx-glint', rect.left, rect.top);
  g.style.width = `${rect.width}px`;
  g.style.height = `${rect.height}px`;
  const shine = g.appendChild(document.createElement('i'));
  void animate(shine, [{ transform: 'translateX(-120%) skewX(-20deg)' }, { transform: 'translateX(220%) skewX(-20deg)' }], 450 * r, { easing: EASING.easeInOut }).then(() => g.remove());
  particles(el, 8, ['#e6ecf2', '#9fb3c4', '#ffffff'], r, 24, 450, 'fx-shard');
}

/** A card face drawn over the table for a moment (an instant spell has no slot to fly to). */
const GHOST_CAT: Record<string, string> = { terrain: 'cat-terr', equipment: 'cat-equip', character: 'cat-char' };
function ghostCard(cardId: string, at: Pt, w: number): HTMLElement {
  const card = CATALOG.get(cardId);
  const art = card ? cardArt(card) : undefined;
  const el = overlay('fx-card', at.x, at.y);
  el.style.width = `${w}px`;
  el.innerHTML = `<span class="card card-hand ${GHOST_CAT[card?.category ?? ''] ?? 'cat-spell'}"><span class="card-frame"><span class="card-name"></span><span class="card-art"></span><span class="card-foot"></span></span><span class="fx-burn"></span></span>`;
  el.querySelector('.card-name')!.textContent = card?.name ?? '';
  if (art) {
    const img = document.createElement('img');
    img.src = art;
    img.alt = '';
    el.querySelector('.card-art')!.appendChild(img);
  }
  return el;
}

/** Story 13.6: a card flies from the hand to above its small seal, holds at the demo's size, then shrinks into it. */
function zoneGhost(cardId: string, from: Pt, seal: HTMLElement, fly: number, r: number) {
  const to = ptOf(seal);
  if (!to) return;
  const w = STAGE_W;
  const h = w * 1.4;
  const at = { x: Math.min(innerWidth - w / 2 - 4, Math.max(w / 2 + 4, to.x)), y: Math.min(innerHeight - h / 2 - 4, Math.max(h / 2 + 4, to.y)), w };
  const g = ghostCard(cardId, at, w);
  g.querySelector('.fx-burn')?.remove();
  void animate(seal, [{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], fly + 710 * r, { easing: 'linear' });
  const dx = from.x - at.x;
  const dy = from.y - at.y;
  const hold = 450 * r;
  const total = fly + hold + 260 * r;
  const o = (t: number) => t / total;
  // story 13.11: the same entrance as a character (step back, arc, overshooting landing), then a hold and a dive
  const entrance = entranceFrames(dx, dy, Math.max(0.3, from.w / w), 0, 1, 'translate(-50%,-50%)').map((f) => ({ ...f, offset: o(fly * (f.offset as number)) }));
  entrance[entrance.length - 1]!.easing = EASING.linear;
  void animate(
    g,
    [
      ...entrance,
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1, offset: o(fly + hold), easing: EASING.easeIn },
      { transform: `translate(-50%,-50%) translate(${to.x - at.x}px, ${to.y - at.y}px) scale(${Math.max(0.15, to.w / w)}) rotate(0deg)`, opacity: 0.2 },
    ],
    total,
    { easing: 'linear' },
  ).then(() => g.remove());
}

/** Where the middle of the table is (the turn banner). */
const tableMid = (): Pt => ptOf(document.querySelector('.table .banner')) ?? { x: innerWidth / 2, y: innerHeight / 2, w: 0 };

/** Instant spell: the card leaves the hand, grows over the middle of the table and burns away in embers. */
function castSpell(cardId: string, from: Pt, ms: number, r: number) {
  const mid = tableMid();
  const w = 96;
  const g = ghostCard(cardId, mid, w);
  const dx = from.x - mid.x;
  const dy = from.y - mid.y;
  const s0 = Math.max(0.3, from.w / w);
  const start: Keyframe = { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(${s0})`, opacity: 0.9, easing: EASING.easeInOut };
  // when the burn starts (fraction of the beat)
  let burn = 0.55;
  let frames: Keyframe[];
  if (compactTable()) {
    // story 13.7: the demo's pace on the portrait phone table (flight, grow, hold, burn: PHONE_SPELL)
    const t = PHONE_SPELL.fly + PHONE_SPELL.grow + PHONE_SPELL.hold + PHONE_SPELL.burn;
    const f = PHONE_SPELL.fly / t;
    const grown = (PHONE_SPELL.fly + PHONE_SPELL.grow) / t;
    burn = (PHONE_SPELL.fly + PHONE_SPELL.grow + PHONE_SPELL.hold) / t;
    frames = [
      start,
      { transform: `translate(-50%,-50%) translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(1.3)`, opacity: 1, offset: f * 0.55, easing: EASING.easeInOut },
      { transform: 'translate(-50%,-50%) translate(0px, -18px) scale(1.15)', opacity: 1, offset: f * 0.82, easing: EASING.easeOut },
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1)', opacity: 1, offset: f, easing: EASING.easeOut },
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1.35)', opacity: 1, offset: grown, easing: EASING.linear },
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1.35)', opacity: 1, offset: burn, easing: EASING.easeIn },
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1.2)', opacity: 0 },
    ];
  } else {
    frames = [
      start,
      { transform: `translate(-50%,-50%) translate(${dx * 0.4}px, ${dy * 0.4 - 50}px) scale(1.1)`, opacity: 1, offset: 0.3, easing: EASING.easeOut },
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1.35)', opacity: 1, offset: 0.55, easing: EASING.linear },
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1.3)', opacity: 1, offset: 0.7, easing: EASING.easeIn },
      { transform: 'translate(-50%,-50%) translate(0px, -6px) scale(1.2)', opacity: 0 },
    ];
  }
  void animate(g, frames, ms, { easing: 'linear' }).then(() => g.remove());
  void animate(g.querySelector('.fx-burn'), [{ opacity: 0 }, { opacity: 0, offset: burn }, { opacity: 1 }], ms, { easing: 'linear' });
  later(() => {
    const box = overlay('fx-anchor', mid.x - w * 0.65, mid.y - w * 0.9);
    box.style.width = `${w * 1.3}px`;
    box.style.height = `${w * 1.8}px`;
    particles(box, 18, ['#ff8a3d', '#ffd27a', '#c0392b'], r, 90, 700);
    later(() => box.remove(), 1200 * r);
  }, ms * Math.max(0.6, burn));
}

/** Where a card leaves its owner's hand from. */
function handOrigin(iid: string, owner: PlayerId): Pt | null {
  // story 13.10: a card that was in the spotlight leaves from the middle of the table
  const spot = spotFrom.get(iid);
  if (spot) {
    spotFrom.delete(iid);
    return spot;
  }
  const seen = handSeen.get(iid);
  if (seen && owner === myId()) return seen.pt;
  return ptOf(handZone(owner));
}

function played(e: Extract<GameEvent, { type: 'cardPlayed' }>, ms: number, r: number, after: GameState, retime?: Retime) {
  const from = handOrigin(e.iid, e.player);
  if (e.zone === 'resolved') {
    if (from) castSpell(e.cardId, from, ms, r);
    return;
  }
  const el = boardEl(e.iid);
  if (!el) return;
  // story 13.11: the entrance takes 850 ms (was 620; 1100 on the portrait phone), with its step back and its
  // overshooting landing
  const base = Math.min(ms, (compactTable() ? PHONE_ENTRANCE_MS : ENTRANCE_MS) * r);
  // story 13.13: a longer way from the hand (or the spotlight) to the slot takes longer; the beat follows
  const to = ptOf(el);
  const fly = from && to ? base * travelK(dist(from, to), 'fly') : base;
  if (fly !== base) retime?.(ms + 16 + fly - base);
  const cat = CATALOG.get(e.cardId)?.category;
  // story 13.6: on the compact table a character lands at the demo's size, then settles into its slot;
  // a terrain or an equipment (a plate in its row, story 14.1) is shown as a card that lands, then shrinks into it
  stage(el, r, fly + 450 * r, 0);
  if (from && compactTable() && !el.classList.contains('card')) zoneGhost(e.cardId, from, el, fly, r);
  else if (from) flyIn(el, from, fly, e.player === myId() ? 0 : -8);
  later(() => {
    const at = boardEl(e.iid);
    if (!at) return;
    if (cat === 'terrain') {
      sealLanding(at, r);
      familyWave(e.iid, e.player, e.cardId, r, after);
    }
    else if (cat === 'equipment') metalLanding(at, r);
    else runeLanding(at, r);
  }, fly * ENTRANCE_TOUCH);
}

/** Deck → hand. Mine: a back slides to the card's place in the hand, then the card turns over. Foe's: a back only. */
function drawn(iid: string, player: PlayerId, ms: number, r: number, retime?: Retime) {
  const deck = ptOf(counterEl(player, 'Pioche'));
  if (!deck) return;
  const real = player === myId() ? document.querySelector<HTMLElement>(`.table .hand .card[data-iid="${CSS.escape(iid)}"]`) : null;
  const to = real ? ptOf(real) : ptOf(handZone(player));
  if (!to) return;
  // story 13.13: a card drawn further away travels longer, and so does its beat
  const k = travelK(dist(deck, to), 'draw');
  if (k !== 1) retime?.((ms + 16) * k);
  const total = 540 * r * tempo() * k;
  const slide = total * 0.7;
  const b = overlay('fx-back', deck.x, deck.y);
  b.style.width = `${real ? to.w : 34}px`;
  const dx = to.x - deck.x;
  const dy = to.y - deck.y;
  const end = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  void animate(
    b,
    [
      { transform: 'translate(-50%,-50%) scale(.45) rotate(0deg)', opacity: 0.9, easing: EASING.easeInOut },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 50}px)) scale(.9) rotate(-10deg)`, opacity: 1, offset: 0.5, easing: EASING.easeOut },
      { transform: `${end} scale(${real ? 1 : 0.5}) rotate(0deg)`, opacity: 1 },
    ],
    slide,
    { fill: 'forwards', easing: 'linear' },
  ).then(() => {
    if (!real) {
      void animate(b, [{ transform: `${end} scale(.5)`, opacity: 1 }, { transform: `${end} scale(.3)`, opacity: 0 }], 160 * r, { fill: 'forwards', easing: EASING.easeIn }).then(() => b.remove());
      // story 14.2: my card went into my folded hand (the fan button)
      if (player === myId()) popBadge(r);
      return;
    }
    // the back turns to its edge while the real card turns from its edge
    void animate(b, [{ transform: `${end} scaleX(1)`, opacity: 1 }, { transform: `${end} scaleX(0)`, opacity: 0.6 }], total - slide, { easing: EASING.easeIn, fill: 'forwards' }).then(() => b.remove());
  });
  if (real) void animateSteps(real, [{ opacity: 0, scale: '0 1', easing: EASING.linear }, { opacity: 0, scale: '0 1', offset: 0.7, easing: EASING.easeOut }, { opacity: 1, scale: '1 1' }], total);
}

/** A summoned card comes from its zone of origin: a graveyard, a hand, or the other side of the table. */
function summonedIn(e: Extract<GameEvent, { type: 'summoned' }>, before: GameState, ms: number, r: number, retime?: Retime) {
  const el = cardEl(e.iid);
  if (!el) return;
  const holder = ([0, 1] as const).find((p) => before.players[p].hand.includes(e.iid) || before.players[p].graveyard.includes(e.iid));
  let from: Pt | null;
  if (e.from === 'graveyard' && holder !== undefined) from = ptOf(counterEl(holder, 'Cimetière'));
  else if (e.from === 'hand' && holder !== undefined) from = handOrigin(e.iid, holder);
  else from = ptOf(document.querySelector(`.table .board${e.player === myId() ? '.theirs' : '.mine'}`));
  const base = Math.min(ms, (compactTable() ? PHONE_ENTRANCE_MS : ENTRANCE_MS) * r);
  // story 13.13: the flight from its zone of origin takes a time in proportion to the distance
  const to = ptOf(el);
  const fly = from && to ? base * travelK(dist(from, to), 'fly') : base;
  if (fly !== base) retime?.(ms + 16 + fly - base);
  stage(el, r, fly + 450 * r, 0);
  if (from) flyIn(el, { ...from, w: Math.min(from.w, 40) }, fly);
  later(() => {
    const at = cardEl(e.iid);
    if (at) runeLanding(at, r);
  }, fly * ENTRANCE_TOUCH);
}

// ---------------------------------------------------------------------------------------------------------
// Story 12.6: who triggers what. The source pulses, a label (trigger + ability name) rises over it, then a
// beam (a card's ability) or a projectile (a spell) reaches each target. A terrain sends a wave over its family.
// ---------------------------------------------------------------------------------------------------------

/** "À l'arrivée · « Lumière EPOK »" over the source, for a moment. */
function tagOver(at: { x: number; top: number }, text: string, tone: string, r: number) {
  const t = overlay(`fx-tag t-${tone}`, at.x, Math.max(14, at.top - 12));
  t.textContent = text;
  // keep the whole label on screen
  const half = t.offsetWidth / 2;
  t.style.left = `${Math.min(innerWidth - half - 8, Math.max(half + 8, at.x))}px`;
  void animateSteps(
    t,
    [
      { transform: 'translate(-50%,-20%)', opacity: 0, easing: EASING.easeOut },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.2, easing: EASING.linear },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.8, easing: EASING.easeIn },
      { transform: 'translate(-50%,-80%)', opacity: 0 },
    ],
    1300 * Math.max(r, 0.5),
  ).then(() => t.remove());
}

/** A glowing orb in an arc from a spell to its target (demo scene "Sort"). */
function projectile(from: Pt, to: HTMLElement, ms: number) {
  const b = ptOf(to);
  if (!b) return;
  const o = overlay('fx-orb', from.x, from.y);
  const dx = b.x - from.x;
  const dy = b.y - from.y;
  void animateSteps(
    o,
    [
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0.6, easing: EASING.easeOut },
      { transform: `translate(calc(-50% + ${dx * 0.4 + 50}px), calc(-50% + ${dy * 0.4 - 40}px)) scale(1)`, opacity: 1, offset: 0.5, easing: EASING.easeIn },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.2)`, opacity: 1 },
    ],
    ms,
  ).then(() => o.remove());
}

/** Where a fired ability comes from: its card on the table, or the middle of the table for a spell. */
function abilityFired(e: Extract<GameEvent, { type: 'abilityUsed' }>, events: GameEvent[], index: number, gap: number, r: number, after: GameState, retime?: Retime) {
  const card = CATALOG.get(after.instances[e.iid]?.cardId ?? '');
  const ab = card?.abilities[e.ability];
  const special = e.trigger === 'attack' || e.trigger === 'reaction';
  const spell = card?.category === 'spell';
  const src = spell ? null : boardEl(e.iid);
  // story 13.6: the source shows at the demo's size while it fires
  stage(src, r, gap + 700 * r);
  const mid = tableMid();
  const from: Pt = ptOf(src) ?? mid;
  if (src) glow(src, r);
  const label = card && ab ? abilityTag(card, ab) : { label: special ? 'Attaque spéciale' : 'Effet', tone: 'eff' };
  const rect = src ? rectOf(src) : undefined;
  tagOver({ x: from.x, top: rect ? rect.top : mid.y - 70 }, `${label.label} · « ${e.name} »`, label.tone, r);
  const targets = effectTargets(events, index)
    .map(elOf)
    .filter((x): x is HTMLElement => !!x && x !== src);
  if (!targets.length) return;
  // the label shows first, then the effect leaves (straight away for a special attack, as in 12.2)
  const delay = special ? 0 : Math.min(gap * 0.45, 260 * r);
  // story 13.13: the beam or the orb takes a time in proportion to the way to its farthest target; the beat follows
  const k = travelK(Math.max(...targets.map((t) => dist(from, center(t)))), 'effect');
  if (k !== 1) retime?.(gap + (gap - delay) * (k - 1));
  later(() => {
    for (const to of targets) {
      // story 13.6: a card target is staged before the beam or the orb leaves, so it aims at its staged place
      if (targets.length <= 2) stageHit(to, r, gap * k + 900 * r);
      if (spell || !src) projectile(from, to, Math.max(200 * r, gap - delay) * k);
      else beam(src, to, r, e.trigger === 'reaction' ? '#ffd27a' : special ? '#b8d4ff' : '#9fe0b0', k);
    }
  }, delay);
}

/** Story 12.6: a terrain's colour wave runs over the cards of its family on its owner's side. */
function familyWave(terrainIid: string, owner: PlayerId, cardId: string, r: number, after: GameState) {
  const terrain = CATALOG.get(cardId);
  const origin = ptOf(boardEl(terrainIid));
  if (!terrain || !origin) return;
  for (const iid of after.players[owner].characters) {
    if (!iid || CATALOG.get(after.instances[iid]?.cardId ?? '')?.set !== terrain.set) continue;
    const el = cardEl(iid);
    const at = ptOf(el);
    if (!el || !at) continue;
    const delay = (Math.hypot(at.x - origin.x, at.y - origin.y) * 0.9 + 250) * r;
    later(() => {
      tint(el, 'family', r, 520);
      void animateSteps(el, [{ scale: '1', easing: EASING.easeOut }, { scale: '1.07', offset: 0.4, easing: EASING.easeInOut }, { scale: '1' }], 420 * r);
    }, delay);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Story 12.7: the rhythm of the turn. A banner unrolls ("À toi de jouer", or a quieter "Tour adverse"), the
// hourglass turns over and my playable cards light up; the end of the game breaks the loser's portrait.
// ---------------------------------------------------------------------------------------------------------

function turnBanner(mine: boolean, r: number) {
  const mid = tableMid();
  const b = overlay(`fx-turn${mine ? ' mine' : ''}`, innerWidth / 2, mid.y);
  b.innerHTML = '<div></div>';
  b.firstElementChild!.textContent = mine ? 'À toi de jouer' : 'Tour adverse';
  const inner = b.firstElementChild!;
  const open = (mine ? 450 : 320) * r;
  const hold = (mine ? 450 : 250) * r;
  const out = (mine ? 300 : 220) * r;
  animateSteps(inner, [{ transform: 'scaleX(0)', opacity: 0, easing: EASING.easeOut }, { transform: 'scaleX(1.05)', opacity: 1, offset: 0.5, easing: EASING.easeInOut }, { transform: 'scaleX(1)', opacity: 1 }], open)
    .then(() => new Promise((res) => later(() => res(undefined), hold)))
    .then(() => animate(inner, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-30px)', opacity: 0 }], out, { fill: 'forwards', easing: EASING.easeIn }))
    .then(() => b.remove());
  // the hourglass turns over
  void animate(document.querySelector('.table .timer svg'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }], 500 * r, { easing: EASING.easeInOut });
  if (mine) later(() => playableGlow(r), open + hold);
}

/** My playable cards light up for a moment (hand cards I can afford, characters ready to attack). */
export function playableGlow(r: number) {
  // story 13.12: every place is read first, then the glows are added (no layout between two reads)
  const rects = [...document.querySelectorAll<HTMLElement>('.table .hand .card.is-ready, .table .board.mine .card.is-ready')].map((el) => el.getBoundingClientRect());
  rects.forEach((rect, i) => {
    if (!rect.width) return;
    const g = overlay('fx-glow playable', rect.left, rect.top);
    g.style.width = `${rect.width}px`;
    g.style.height = `${rect.height}px`;
    void animate(g, [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], 1200 * Math.max(r, 0.5), { delay: i * 40 * r, easing: EASING.linear }).then(() => g.remove());
  });
}

/** End of the game: the loser's portrait cracks and shatters; gold rains for my victory, the table darkens for my defeat. */
function gameEnd(winner: PlayerId | 'draw', ms: number, r: number) {
  const me = myId();
  const loser = winner === 'draw' ? null : (winner === 0 ? 1 : 0);
  const k = Math.max(r, 0.5);
  if (loser !== null) {
    const face = portraitEl(loser);
    if (face) {
      const c = ptOf(face)!;
      const cr = overlay('fx-crack portrait', c.x, c.y, CRACKS_SVG);
      cr.style.width = cr.style.height = `${c.w * 1.4}px`;
      void animateSteps(cr, [{ transform: 'translate(-50%,-50%) scale(.8)', opacity: 0, easing: EASING.snap }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.3, easing: EASING.linear }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.6, easing: EASING.easeIn }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], 900 * k).then(() => cr.remove());
      void animateSteps(face, [{ transform: 'scale(1) rotate(0deg)', opacity: 1, easing: EASING.easeOut }, { transform: 'scale(1.1) rotate(-4deg)', opacity: 1, offset: 0.35, easing: EASING.easeInOut }, { transform: 'scale(1.1) rotate(4deg)', opacity: 1, offset: 0.5, easing: EASING.easeIn }, { transform: 'scale(.4) rotate(0deg)', opacity: 0 }], 900 * k, EASING.easeOut, { fill: 'forwards' });
      later(() => {
        particles(face, 16, ['#f2d27a', '#8e1f1f', '#fff3d6', '#5a3d0c'], r, 70, 800, 'fx-shard');
        shake(120, r);
      }, 500 * k);
    }
  }
  if (winner === me) {
    const coins = compactTable() ? PHONE_FX.gold : 36;
    for (let i = 0; i < coins; i++) {
      const x = (innerWidth * ((i * 37) % 100)) / 100;
      const coin = overlay('fx-gold', x, -12);
      void animate(coin, [{ transform: 'translateY(0) rotate(0deg)', opacity: 1 }, { transform: `translateY(${innerHeight + 30}px) rotate(${(i % 2 ? 1 : -1) * 540}deg)`, opacity: 0.9 }], (1300 + ((i * 53) % 700)) * k, { delay: (500 + ((i * 29) % 900)) * k, easing: EASING.easeIn }).then(() => coin.remove());
    }
  } else {
    const veil = overlay('fx-veil', 0, 0);
    void animate(veil, [{ opacity: 0 }, { opacity: winner === 'draw' ? 0.35 : 0.6 }], ms * 0.7, { fill: 'forwards', easing: EASING.linear });
    later(() => veil.remove(), ms + 200);
  }
}



// ---------------------------------------------------------------------------------------------------------
// Story 13.10 (demo scenes « Mise en avant » and « Carte retirée »). A spell, or a card with an "À l'arrivée"
// effect, is first shown in the middle of the darkened table with who plays it and its effect (a tap skips it);
// then it goes on as before, leaving from the middle. One of my cards removed by an opposing effect glows red with a
// stamp, leaves, its slot blinks with a red dashed outline and a red alert names what happened.
// ---------------------------------------------------------------------------------------------------------

/** Where a card shown in the spotlight is when the spotlight ends: its flight to the table leaves from there. */
const spotFrom = new Map<string, Pt>();
/** The overlays of the spotlight being played, and how to end it. */
let spotNow: { token: number; els: HTMLElement[]; hidden: HTMLElement | null; ghost: HTMLElement; root: Root } | null = null;
let spotToken = 0;

function endSpot(ms: number) {
  const s = spotNow;
  if (!s) return;
  spotNow = null;
  if (s.hidden) s.hidden.style.visibility = '';
  const gone = (el: HTMLElement) => {
    if (el === s.ghost) setTimeout(() => s.root.unmount(), 0);
    el.remove();
  };
  for (const el of [...s.els, s.ghost]) {
    if (ms <= 0) gone(el);
    else void animate(el, [{ opacity: Number(getComputedStyle(el).opacity) || 1 }, { opacity: 0 }], ms, { fill: 'forwards', easing: EASING.linear }).then(() => gone(el));
  }
}
/** Story 13.10: everything queued was dropped (instant speed, hidden tab): the spotlight and alerts go at once. */
export function clearLeads() {
  spotToken++;
  endSpot(0);
  document.querySelectorAll('.fx-spot-veil, .fx-spot, .fx-stamp, .fx-removed, .fx-ghost-slot').forEach((el) => el.remove());
  document.querySelectorAll<HTMLElement>('.table .card.removed-glow').forEach((el) => el.classList.remove('removed-glow'));
}

function spotlight(cue: Cue, spot: NonNullable<Cue['beat']['spot']>) {
  const r = cue.rate;
  const card = CATALOG.get(spot.cardId);
  const ab = card?.abilities[spot.ability];
  if (!card || !ab) return;
  endSpot(0);
  const token = ++spotToken;
  const me = spot.player === myId();
  const who = card.category === 'spell' ? (me ? 'Vous jouez un sort' : `${cue.names?.[spot.player] || 'L’adversaire'} joue un sort`) : me ? `Vous posez ${card.name}` : `${cue.names?.[spot.player] || 'L’adversaire'} pose ${card.name}`;
  const tag = abilityTag(card, ab);
  const label = card.category === 'spell' ? `Sort · ${tag.label}` : tag.label;
  const w = Math.round(Math.max(110, Math.min(200, innerWidth * 0.42, (innerHeight - 330) / 1.4)));

  const veil = overlay('fx-spot-veil', 0, 0);
  const box = overlay('fx-spot', 0, 0);
  box.innerHTML = `<div class="who"></div><div class="hole"></div><div class="panel"><span class="lab"></span><div class="q"></div><div class="tx"></div><div class="bar"><i></i></div></div><div class="skip">Touchez pour passer</div>`;
  box.querySelector<HTMLElement>('.hole')!.style.cssText = `width:${w}px;height:${Math.round(w * 1.4)}px`;
  box.querySelector('.who')!.textContent = who;
  const lab = box.querySelector<HTMLElement>('.lab')!;
  lab.textContent = label;
  lab.classList.add(`t-${tag.tone}`);
  box.querySelector('.q')!.textContent = `« ${ab.name} »`;
  box.querySelector('.tx')!.textContent = abilityBody(card, ab);
  const hole = ptOf(box.querySelector('.hole'))!;
  const at: Pt = { x: hole.x, y: hole.y, w };
  // the card leaves its owner's hand (my hand card hides while it is in the spotlight)
  const from = handOrigin(spot.iid, spot.player) ?? { x: at.x, y: innerHeight, w: 40 };
  const hidden = document.querySelector<HTMLElement>(`.table .hand .card[data-iid="${CSS.escape(spot.iid)}"]`);
  if (hidden) hidden.style.visibility = 'hidden';
  // the whole card (cost, art, stats), as in the hand
  const ghost = overlay('fx-card fx-spot-card', at.x, at.y);
  ghost.style.width = `${w}px`;
  ghost.style.transform = 'translate(-50%,-50%)';
  const root = createRoot(ghost);
  root.render(createElement(CardView, { card, size: 'hand' }));
  spotNow = { token, els: [veil, box], hidden, ghost, root };
  spotFrom.set(spot.iid, at);

  const skip = () => {
    if (spotToken !== token) return;
    endSpot(160);
    cue.skip?.();
  };
  veil.addEventListener('pointerdown', skip);
  box.addEventListener('pointerdown', skip);
  ghost.addEventListener('pointerdown', skip);

  const enter = SPOT.enter * r;
  const panel = SPOT.panel * r;
  const hold = SPOT.hold * r;
  const exit = SPOT.exit * r;
  void animate(veil, [{ opacity: 0 }, { opacity: 1 }], 300 * r, { fill: 'forwards', easing: EASING.linear });
  // the demo's entry: accelerates over the table, overshoots (1.09 ≈ the demo's 1.75 / 1.6), then settles
  void animate(
    ghost,
    [
      { transform: `translate(-50%,-50%) translate(${from.x - at.x}px, ${from.y - at.y}px) scale(${Math.max(0.2, from.w / w)}) rotate(${me ? 0 : 4}deg)`, opacity: 0.9, easing: EASING.easeInOut },
      { transform: 'translate(-50%,-50%) translate(0px, -20px) scale(1.09) rotate(0deg)', opacity: 1, offset: 0.78, easing: EASING.overshoot },
      { transform: 'translate(-50%,-50%) translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1 },
    ],
    enter,
    { easing: 'linear' },
  );
  const still = () => spotToken === token && spotNow?.token === token;
  later(() => {
    if (!still()) return;
    const whoEl = box.querySelector<HTMLElement>('.who')!;
    const pan = box.querySelector<HTMLElement>('.panel')!;
    const sk = box.querySelector<HTMLElement>('.skip')!;
    void animate(whoEl, [{ opacity: 0 }, { opacity: 1 }], 250 * r, { fill: 'forwards', easing: EASING.linear });
    for (const el of [pan, sk]) void animate(el, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], panel, { fill: 'forwards', easing: EASING.easeOut });
    void animate(box.querySelector('.bar i'), [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], hold, { delay: panel, fill: 'forwards', easing: EASING.linear });
  }, enter);
  later(() => {
    if (!still()) return;
    endSpot(exit);
  }, enter + panel + hold);
}

/** Story 13.10: the red glow and stamp on my card, while it is still in its slot. */
const removedAt = new Map<string, DOMRect>();
function removalStamp(cue: Cue, rm: NonNullable<Cue['beat']['removal']>) {
  const r = cue.rate;
  const card = boardEl(rm.iid);
  if (!card) return;
  const rect = card.getBoundingClientRect();
  removedAt.set(rm.iid, rect);
  stage(card, r, cue.ms + 400 * r);
  card.classList.add('removed-glow');
  const c = center(card);
  const st = overlay('fx-stamp', c.x, c.y);
  st.textContent = STAMP[rm.kind];
  void animate(st, [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-12deg) scale(2)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-12deg) scale(1)' }], REMOVAL.stamp * r, { fill: 'forwards', easing: EASING.snap });
  later(() => st.remove(), Math.max(0, cue.ms - 20));
}

/** Story 13.10: once the card leaves, its slot blinks red for ~2 s and a red alert stays ~4 s at the top. */
function removalAlert(cue: Cue, rm: NonNullable<Cue['beat']['removal']>) {
  const r = cue.rate;
  const card = boardEl(rm.iid);
  if (card) later(() => card.classList.remove('removed-glow'), REMOVAL.ghost * Math.max(r, 0.5));
  const rect = removedAt.get(rm.iid) ?? card?.getBoundingClientRect();
  removedAt.delete(rm.iid);
  if (rect && rect.width) {
    const g = overlay('fx-ghost-slot', rect.left, rect.top);
    g.style.width = `${rect.width}px`;
    g.style.height = `${rect.height}px`;
    void animate(g, [{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }, { opacity: 0 }], REMOVAL.ghost * Math.max(r, 0.5), { easing: EASING.linear }).then(() => g.remove());
  }
  const mine = rm.owner === myId();
  const cardIdOf = (iid: string) => cue.before.instances[iid]?.cardId ?? cue.after.instances[iid]?.cardId;
  const { title, body } = removalText(rm, CATALOG, cardIdOf, mine);
  document.querySelectorAll('.fx-removed').forEach((el) => el.remove());
  const t = overlay('fx-removed', innerWidth / 2, 0, '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffb59e" stroke-width="2" aria-hidden="true"><path d="M12 3l10 18H2z"></path><path d="M12 10v5M12 18h.01"></path></svg><div><b></b><span></span></div>');
  t.setAttribute('role', 'alert');
  t.removeAttribute('aria-hidden');
  t.querySelector('b')!.textContent = title;
  t.querySelector('span')!.textContent = body;
  // under the foe's hero bar, centred on the table (the desktop table sits between the journal and the sheet)
  const top = (document.querySelector('.table [data-hero]')?.getBoundingClientRect().bottom ?? 60) + 8;
  const tb = document.querySelector('.table')?.getBoundingClientRect();
  t.style.top = `${Math.round(top)}px`;
  if (tb && tb.width) t.style.left = `${Math.round(tb.left + tb.width / 2)}px`;
  void animate(
    t,
    [
      { opacity: 0, transform: 'translate(-50%,-12px)', easing: EASING.easeOut },
      { opacity: 1, transform: 'translate(-50%,0)', offset: 0.08, easing: EASING.linear },
      { opacity: 1, transform: 'translate(-50%,0)', offset: 0.9, easing: EASING.easeIn },
      { opacity: 0, transform: 'translate(-50%,-8px)' },
    ],
    REMOVAL.alert,
    { easing: 'linear' },
  ).then(() => t.remove());
}

export function direct(cue: Cue) {
  const { beat, rate: r, events } = cue;
  const e = beat.event;
  if (cue.lead) {
    if (beat.spot) spotlight(cue, beat.spot);
    else if (beat.removal) removalStamp(cue, beat.removal);
    return;
  }
  if (beat.removal) removalAlert(cue, beat.removal);
  if (current && performance.now() > current.until) current = null;
  switch (e.type) {
    case 'attackDeclared': {
      const att = cardEl(e.attacker);
      const tgt = targetEl(e.target);
      current = { attacker: e.attacker, target: e.target, until: performance.now() + 2000 * r };
      if (att && tgt) lunge(att, tgt, r, cue.retime);
      break;
    }
    case 'damageDealt': {
      const tgt = elOf(e.target);
      if (!tgt) break;
      stageHit(tgt, r, cue.ms + 700 * r);
      const c = center(tgt);
      if (e.absorbed > 0) shieldHit(tgt, e.absorbed, !cue.after.instances[e.target]?.statuses.some((st) => st.kind === 'shield'), r);
      if (e.amount <= 0) {
        if (!e.absorbed) floatText(c.x, c.y, '0', '#c9c2b4', 16 * fitOf(tgt), r);
        break;
      }
      floatText(c.x, c.y - 6, `−${e.amount}`, '#ffd7c2', Math.min(30, 15 + e.amount / 10) * fitOf(tgt) * 1.1, r, 'dmg');
      tint(tgt, 'hurt', r);
      const riposte = !!current && e.target === current.attacker && current.target.kind === 'card' && e.source === current.target.iid;
      splat(tgt, e.amount, r, riposte);
      recoil(tgt, elOf(e.source), r, riposte ? 0.7 : 1);
      shake(riposte ? e.amount * 0.6 : e.amount, r);
      break;
    }
    case 'playerDamaged': {
      const hero = heroEl(e.player);
      const face = portraitEl(e.player);
      if (!hero || !face) break;
      splat(face, e.amount, r);
      const c = center(face);
      floatText(c.x + 30, c.y, `−${e.amount}`, '#ff6a5a', Math.min(40, 20 + e.amount / 8), r, 'dmg');
      recoil(hero, current ? cardEl(current.attacker) : null, r, 0.8);
      shake(e.amount, r);
      break;
    }
    case 'cardDestroyed': {
      const { iid, owner } = e;
      stage(cardEl(iid), r, cue.ms + 200);
      // the dying card gets its cracks and scorch layers on this beat's render
      requestAnimationFrame(() => death(iid, owner, Math.max(0, cue.ms - 16), r));
      break;
    }
    case 'cardPlayed': {
      const ms = Math.max(0, cue.ms - 16);
      const after = cue.after;
      requestAnimationFrame(() => played(e, ms, r, after, cue.retime));
      break;
    }
    case 'cardDrawn': {
      const { iid, player } = e;
      const ms = Math.max(0, cue.ms - 16);
      requestAnimationFrame(() => drawn(iid, player, ms, r, cue.retime));
      break;
    }
    case 'summoned': {
      const ms = Math.max(0, cue.ms - 16);
      const before = cue.before;
      requestAnimationFrame(() => summonedIn(e, before, ms, r, cue.retime));
      break;
    }
    case 'deathPrevented':
      stage(cardEl(e.iid), r, cue.ms + 500 * r);
      saved(e.iid, cue.ms, r);
      break;
    case 'returnedToHand': {
      const { iid, owner } = e;
      requestAnimationFrame(() => backToHand(iid, owner, Math.max(0, cue.ms - 16), cue.retime));
      break;
    }
    case 'healed': {
      const tgt = elOf(e.target);
      if (!tgt) break;
      stageHit(tgt, r, cue.ms + 600 * r);
      const c = center(tgt);
      tint(tgt, 'heal', r, 500);
      particles(tgt, 8, ['#6fdc8c', '#c6f5a8'], r, 45, 650);
      floatText(c.x, c.y - 6, `+${e.amount}`, '#7fe0a8', Math.min(28, 15 + e.amount / 10) * fitOf(tgt), r, 'heal');
      break;
    }
    case 'modified': {
      const tgt = cardEl(e.target);
      if (!tgt) break;
      stageHit(tgt, r, cue.ms + 700 * r);
      if (e.atk) statArrow(tgt, 'atk', e.atk, r);
      if (e.hp) statArrow(tgt, 'hp', e.hp, r);
      break;
    }
    case 'statusApplied': {
      const tgt = cardEl(e.target);
      stageHit(tgt, r, cue.ms + 700 * r);
      if (tgt) statusFx(tgt, e.status, r);
      break;
    }
    case 'abilityUsed':
      abilityFired(e, events, beat.index, cue.ms, r, cue.after, cue.retime);
      break;
    case 'turnStarted':
      turnBanner(e.player === myId(), r);
      break;
    case 'gameOver':
      gameEnd(e.winner, cue.ms, r);
      break;
    default:
      break;
  }
}
