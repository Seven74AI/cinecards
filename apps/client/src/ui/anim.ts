import { prefersReducedMotion } from '../game/playback.ts';
import { EASING } from '../game/motion.ts';

export { EASING, ENTRANCE_MS, PHONE_ENTRANCE_MS, PHONE_TEMPO } from '../game/motion.ts';

/** Easing of the approved demo (docs/design/animations/demo.html), the default of `animate`. */
export const EASE = EASING.easeOut;

/** When, in the entrance, the card touches its slot (the landing effect starts). */
export const ENTRANCE_TOUCH = 0.86;

/**
 * Story 13.11: the hand → table flight. A small step back away from the table (anticipation), an arc that
 * grows over the slot, then a landing that overshoots a little and settles. `dx`/`dy`: from the slot to where the
 * card starts; `s0` its scale there; `k` the stage scale the transform is drawn in (1 off the compact table);
 * `pre` a transform put before each step (the ghosts' `translate(-50%,-50%)`). Offsets are fractions of the flight.
 */
export function entranceFrames(dx: number, dy: number, s0: number, tilt = 0, k = 1, pre = ''): Keyframe[] {
  const len = Math.hypot(dx, dy) || 1;
  // the step back: 10 px further from the slot, along the flight
  const bx = dx + (dx / len) * (10 / k);
  const by = dy + (dy / len) * (10 / k);
  const p = pre ? `${pre} ` : '';
  return [
    { transform: `${p}translate(${dx}px, ${dy}px) scale(${s0}) rotate(${tilt}deg)`, opacity: 0.9, offset: 0, easing: EASING.easeOut },
    { transform: `${p}translate(${bx}px, ${by}px) scale(${s0 * 0.94}) rotate(${tilt * 1.3}deg)`, opacity: 0.95, offset: 0.12, easing: EASING.easeInOut },
    { transform: `${p}translate(${dx * 0.45}px, ${dy * 0.45 - 70 / k}px) scale(1.3) rotate(0deg)`, opacity: 1, offset: 0.58, easing: EASING.easeInOut },
    { transform: `${p}translate(0px, ${-18 / k}px) scale(1.15) rotate(0deg)`, opacity: 1, offset: 0.8, easing: EASING.overshoot },
    { transform: `${p}translate(0px, 0px) scale(1) rotate(0deg)`, opacity: 1, offset: 1 },
  ];
}

/**
 * Web Animations helper (epic 12): only `transform` and `opacity` are animated (no layout, 60 fps).
 * With "reduce motion", every keyframe keeps only its opacity: movements become fades.
 */
export function animate(el: Element | null | undefined, frames: Keyframe[], ms: number, opts: KeyframeAnimationOptions = {}): Promise<void> {
  if (!el || ms <= 0 || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
  return (el as HTMLElement)
    .animate(motionFrames(frames, prefersReducedMotion()), { duration: ms, easing: EASE, ...opts })
    .finished.then(() => undefined)
    .catch(() => undefined);
}

/** With "reduce motion" a keyframe keeps only its opacity (and its offset): a movement becomes a fade. */
export function motionFrames(frames: Keyframe[], reduced: boolean): Keyframe[] {
  return reduced ? frames.map((k) => ({ opacity: k.opacity ?? 1, ...(k.offset !== undefined ? { offset: k.offset } : {}) })) : frames;
}

/**
 * Story 13.11: a timeline whose keyframes carry their own curve. `frames[i].easing` (default `ease`) is the curve
 * of the segment that starts at frame i; the timeline itself runs linear so the offsets stay where they are.
 */
export function stepFrames(frames: Keyframe[], ease: string = EASING.easeOut): Keyframe[] {
  return frames.map((k, i) => (i < frames.length - 1 && k.easing === undefined ? { ...k, easing: ease } : k));
}
export function animateSteps(el: Element | null | undefined, frames: Keyframe[], ms: number, ease: string = EASING.easeOut, opts: KeyframeAnimationOptions = {}): Promise<void> {
  return animate(el, stepFrames(frames, ease), ms, { ...opts, easing: 'linear' });
}

export const cardEl = (iid: string) => document.querySelector<HTMLElement>(`.board [data-iid="${CSS.escape(iid)}"]`);
