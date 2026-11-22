import type { GameEvent, PlayerId, Target } from '@cinecards/engine';
import type { Cue } from '../game/playback.ts';
import { animate, cardEl, EASE } from './anim.ts';
import { CHAINS_SVG } from './CardView.tsx';
import { iconSvg, STATUS_ICON } from './Icon.tsx';

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
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

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
  const fit = Math.min(1, Math.max(0.6, el.getBoundingClientRect().width / 90));
  const size = fit * (small ? 0.7 : 1) * Math.min(1.5, 0.8 + amount / 200);
  const s = overlay('fx-splat', c.x, c.y, STAR);
  void animate(
    s,
    [
      { transform: `translate(-50%,-50%) scale(${0.2 * size}) rotate(-20deg)`, opacity: 0 },
      { transform: `translate(-50%,-50%) scale(${1.15 * size}) rotate(5deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(-50%,-50%) scale(${size}) rotate(0)`, opacity: 0.9, offset: 0.6 },
      { transform: `translate(-50%,-50%) scale(${1.1 * size})`, opacity: 0 },
    ],
    700 * r,
  ).then(() => s.remove());
}

/** The table shakes in proportion to the damage. */
export function shake(amount: number, r: number) {
  const p = Math.min(10, 2 + amount / 25);
  void animate(
    document.querySelector('.table'),
    [{ translate: '0 0' }, { translate: `${p}px ${-p / 2}px` }, { translate: `${-p}px ${p / 2}px` }, { translate: `${p / 2}px 0` }, { translate: '0 0' }],
    320 * r,
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
  void animate(el, [{ translate: '0 0', rotate: '0deg' }, { translate: `${dx}px ${dy}px`, rotate: `${3 * power}deg` }, { translate: '0 0', rotate: '0deg' }], 260 * r, { composite: 'add' });
}

/** Attack: lift, dash at the target (stopping short), then come back once the hit has landed. */
function lunge(att: HTMLElement, tgt: HTMLElement, r: number) {
  const a = center(att);
  const b = center(tgt);
  // stop just short of the target (the demo stops at 78 % of a short distance), so the cards touch
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const k = Math.max(0, len - Math.min(len * 0.22, tgt.getBoundingClientRect().height * 0.45)) / len;
  const dx = (b.x - a.x) * k;
  const dy = (b.y - a.y) * k;
  att.style.zIndex = '30';
  const lift = 220 * r;
  const dash = 170 * r;
  const back = 380 * r;
  void animate(
    att,
    [
      { transform: 'translate(0,0) scale(1)', offset: 0, easing: EASE },
      { transform: 'translate(0,6px) scale(1.12)', offset: lift / (lift + dash), easing: 'cubic-bezier(.6,0,.9,.5)' },
      { transform: `translate(${dx}px,${dy}px) scale(1.05)`, offset: 1 },
    ],
    lift + dash,
    { fill: 'forwards', easing: 'linear' },
  ).then(() => {
    const out = att.getAnimations();
    void animate(
      att,
      [
        { transform: `translate(${dx}px,${dy}px) scale(1.05)` },
        { transform: `translate(${dx * 0.8}px,${dy * 0.8}px) scale(1.06)`, offset: 0.2 },
        { transform: 'translate(0,0) scale(1)' },
      ],
      back,
      { easing: EASE },
    ).then(() => {
      att.style.zIndex = '';
    });
    out.forEach((x) => x.cancel());
  });
}

/** Glow of a card whose ability fires. */
function glow(el: HTMLElement, r: number) {
  const g = overlay('fx-glow', 0, 0);
  const rect = el.getBoundingClientRect();
  g.style.left = `${rect.left}px`;
  g.style.top = `${rect.top}px`;
  g.style.width = `${rect.width}px`;
  g.style.height = `${rect.height}px`;
  void animate(g, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], 700 * r, { easing: 'linear' }).then(() => g.remove());
}

/** Magic beam from the source to the target, no contact. */
function beam(from: HTMLElement, to: HTMLElement, r: number, color = '#b8d4ff') {
  const a = center(from);
  const b = center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const bm = overlay('fx-beam', a.x, a.y);
  bm.style.width = `${len}px`;
  bm.style.background = `linear-gradient(90deg, transparent, ${color} 30%, #fff 50%, ${color} 70%, transparent)`;
  bm.style.boxShadow = `0 0 14px 2px ${color}`;
  void animate(
    bm,
    [
      { transform: `rotate(${ang}rad) scaleX(0)`, opacity: 1 },
      { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.55 },
      { transform: `rotate(${ang}rad) scaleX(1)`, opacity: 0 },
    ],
    520 * r,
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

/** How big a card is compared with the demo's cards (100 px wide): effects scale with it. */
const fitOf = (el: Element) => Math.min(1.2, Math.max(0.6, el.getBoundingClientRect().width / 90));

/** Story 12.3: a number that splashes up from the target; its size follows the value. */
function floatText(x: number, y: number, text: string, color: string, size: number, r: number, cls = '') {
  const t = overlay(`fx-num ${cls}`, x, y);
  t.textContent = text;
  t.style.color = color;
  t.style.fontSize = `${Math.round(size)}px`;
  void animate(
    t,
    [
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%,-70%) scale(1.25)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-140%) scale(.95)', opacity: 0 },
    ],
    1100 * Math.max(r, 0.5),
  ).then(() => t.remove());
}

/** A colored veil over the card for a moment (the card "turns red" when hit, glows green when healed). */
function tint(el: HTMLElement, cls: string, r: number, ms = 380) {
  const rect = el.getBoundingClientRect();
  const v = overlay(`fx-tint ${cls}`, rect.left, rect.top);
  v.style.width = `${rect.width}px`;
  v.style.height = `${rect.height}px`;
  void animate(v, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], ms * r).then(() => v.remove());
}

/** Small particles (poison bubbles, healing sparks, shield shards) rising from the card. */
function particles(el: HTMLElement, n: number, colors: string[], r: number, rise = 50, ms = 700, cls = 'fx-dot') {
  const rect = el.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const x = rect.left + rect.width * (0.2 + (0.6 * ((i * 37) % 100)) / 100);
    const y = rect.top + rect.height * (0.55 + (0.35 * ((i * 53) % 100)) / 100);
    const d = overlay(cls, x, y);
    d.style.setProperty('--c', colors[i % colors.length]!);
    const dx = ((i * 29) % 21) - 10;
    const up = rise * (0.6 + ((i * 41) % 40) / 100);
    void animate(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.2 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${up}px)) scale(.6)`, opacity: 0 },
      ],
      ms * r * (0.8 + ((i * 17) % 40) / 100),
      { delay: i * 25 * r },
    ).then(() => d.remove());
  }
}

/** Golden arrow up / violet arrow down on the ATK or HP badge, with the value. */
function statArrow(card: HTMLElement, which: 'atk' | 'hp', delta: number, r: number) {
  const badge = card.querySelector<HTMLElement>(`.badge.${which}`) ?? card;
  const c = center(badge);
  const up = delta > 0;
  const color = up ? '#f2d27a' : '#b98cff';
  const path = up ? 'M12 3l8 10h-5v8H9v-8H4z' : 'M12 21l8-10h-5V3H9v8H4z';
  const a = overlay('fx-arrow', c.x, c.y - 16, `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${path}" fill="${color}" stroke="#2a1a0e" stroke-width="1.2"/></svg><b style="color:${color}">${up ? '+' : '−'}${Math.abs(delta)}</b>`);
  void animate(
    a,
    [
      { transform: `translate(-50%,${up ? '-10%' : '-90%'})`, opacity: 0 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.7 },
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
  const size = card.getBoundingClientRect().width * 0.8;
  const box = (html: string) => {
    const el = overlay('fx-shield', c.x, c.y, html);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    return el;
  };
  const shield = box(SHIELD);
  const crack = box(CRACK);
  const total = (broken ? 700 : 600) * r;
  void animate(
    shield,
    [
      { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.6 },
      { transform: `translate(-50%,-50%) scale(${broken ? 1.3 : 1})`, opacity: 0 },
    ],
    total,
  ).then(() => shield.remove());
  void animate(
    crack,
    [
      { transform: 'translate(-50%,-50%)', opacity: 0 },
      { transform: 'translate(-50%,-50%)', opacity: 0, offset: 0.25 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-50%)', opacity: 1, offset: 0.75 },
      { transform: 'translate(-50%,-50%)', opacity: 0 },
    ],
    total,
  ).then(() => crack.remove());
  if (broken) particles(card, 10, ['#f2d27a', '#fff3d6'], r, 30, 600, 'fx-shard');
  floatText(c.x, c.y + size * 0.35, `absorbé ${absorbed}`, '#c9c2b4', 12 * fitOf(card), r, 'small');
}

/** Each status lands with its own effect: chains for silence, bubbles for poison, a shield, or its icon. */
function statusFx(card: HTMLElement, kind: string, r: number) {
  const meta = STATUS_ICON[kind];
  const c = center(card);
  const rect = card.getBoundingClientRect();
  const land = [
    { transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(.9)', opacity: 1, offset: 0.55 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.8 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
  ];
  if (kind === 'silence') {
    const ch = overlay('fx-chains', c.x, c.y, CHAINS_SVG);
    ch.style.width = `${rect.width}px`;
    ch.style.height = `${rect.height}px`;
    void animate(ch, land, 650 * r).then(() => ch.remove());
  } else if (kind === 'poison') {
    particles(card, 12, ['#8fe36a', '#4fbf3a', '#c6f5a8'], r, 60, 800, 'fx-bubble');
  } else {
    const shield = kind === 'shield';
    const ic = overlay('fx-status', c.x, c.y, shield ? SHIELD : iconSvg(meta?.icon ?? 'star', Math.round(rect.width * 0.5), meta?.color ?? '#f2d27a'));
    if (shield) {
      ic.style.width = `${rect.width * 0.8}px`;
      ic.style.height = `${rect.width * 0.8}px`;
    }
    void animate(ic, land, 650 * r).then(() => ic.remove());
  }
  if (meta) floatText(c.x, rect.top + rect.height * 0.25, meta.label, meta.color, 13 * fitOf(card), r, 'small');
}

export function direct(cue: Cue) {
  const { beat, rate: r, events } = cue;
  const e = beat.event;
  if (current && performance.now() > current.until) current = null;
  switch (e.type) {
    case 'attackDeclared': {
      const att = cardEl(e.attacker);
      const tgt = targetEl(e.target);
      current = { attacker: e.attacker, target: e.target, until: performance.now() + 2000 * r };
      if (att && tgt) lunge(att, tgt, r);
      break;
    }
    case 'damageDealt': {
      const tgt = elOf(e.target);
      if (!tgt) break;
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
    case 'healed': {
      const tgt = elOf(e.target);
      if (!tgt) break;
      const c = center(tgt);
      tint(tgt, 'heal', r, 500);
      particles(tgt, 8, ['#6fdc8c', '#c6f5a8'], r, 45, 650);
      floatText(c.x, c.y - 6, `+${e.amount}`, '#7fe0a8', Math.min(28, 15 + e.amount / 10) * fitOf(tgt), r, 'heal');
      break;
    }
    case 'modified': {
      const tgt = cardEl(e.target);
      if (!tgt) break;
      if (e.atk) statArrow(tgt, 'atk', e.atk, r);
      if (e.hp) statArrow(tgt, 'hp', e.hp, r);
      break;
    }
    case 'statusApplied': {
      const tgt = cardEl(e.target);
      if (tgt) statusFx(tgt, e.status, r);
      break;
    }
    case 'abilityUsed': {
      if (e.trigger !== 'attack' && e.trigger !== 'reaction') break;
      const src = cardEl(e.iid);
      if (!src) break;
      glow(src, r);
      for (const at of effectTargets(events, beat.index)) {
        const to = elOf(at);
        if (to && to !== src) beam(src, to, r, e.trigger === 'reaction' ? '#ffd27a' : '#b8d4ff');
      }
      break;
    }
    default:
      break;
  }
}
