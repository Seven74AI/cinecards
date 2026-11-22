/**
 * Story 13.12: smooth animations on phones. The frame counter shown with `?fps`, and how many particles the
 * portrait phone table draws at once.
 */

/** Average and lowest frame rate over a window of frame durations (ms): the `?fps` counter, once a second. */
export function fpsStats(frames: readonly number[]): { avg: number; min: number } {
  const total = frames.reduce((s, d) => s + d, 0);
  if (!frames.length || total <= 0) return { avg: 0, min: 0 };
  const worst = Math.max(...frames);
  return { avg: Math.round((frames.length * 1000) / total), min: Math.round(1000 / worst) };
}

/** Is the frame counter asked for (`?fps` in the address)? */
export const fpsWanted = (search: string) => new URLSearchParams(search).has('fps');

/**
 * The portrait phone table (story 13.2's compact table) draws fewer particles: at most `perBurst` per burst and
 * `live` on screen at once; the ashes of a death and the gold rain of a victory get their own, smaller counts.
 * Other layouts keep the demo's counts.
 */
export const PHONE_FX = { perBurst: 7, live: 20, ashes: 6, gold: 14 } as const;

/** How many particles of a burst of `n` to draw, `live` being on screen already. */
export function particleBudget(n: number, phone: boolean, live: number): number {
  if (!phone) return n;
  return Math.max(0, Math.min(n, PHONE_FX.perBurst, PHONE_FX.live - live));
}
