import { prefersReducedMotion } from '../game/playback.ts';

/** Easing of the approved demo (docs/design/animations/demo.html). */
export const EASE = 'cubic-bezier(.2,.7,.2,1)';

/**
 * Web Animations helper (epic 12): only `transform` and `opacity` are animated (no layout, 60 fps).
 * With "reduce motion", every keyframe keeps only its opacity: movements become fades.
 */
export function animate(el: Element | null | undefined, frames: Keyframe[], ms: number, opts: KeyframeAnimationOptions = {}): Promise<void> {
  if (!el || ms <= 0 || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
  const f = prefersReducedMotion() ? frames.map((k) => ({ opacity: k.opacity ?? 1, ...(k.offset !== undefined ? { offset: k.offset } : {}) })) : frames;
  return (el as HTMLElement)
    .animate(f, { duration: ms, easing: EASE, ...opts })
    .finished.then(() => undefined)
    .catch(() => undefined);
}

export const cardEl = (iid: string) => document.querySelector<HTMLElement>(`.board [data-iid="${CSS.escape(iid)}"]`);
