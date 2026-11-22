import type { GameEvent, PlayerId, Target } from '@cinecards/engine';
import type { Cue } from '../game/playback.ts';
import { animate, cardEl, EASE } from './anim.ts';

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
      if (!tgt || e.amount <= 0) break;
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
      recoil(hero, current ? cardEl(current.attacker) : null, r, 0.8);
      shake(e.amount, r);
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
