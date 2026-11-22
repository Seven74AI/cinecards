/**
 * Story 13.11: the one palette of easing curves and the tempo of movements, shared by the beat planner
 * (`fx.ts`), the director (`ui/director.ts`) and the demo (docs/design/animations/demo.html keeps a copy of the
 * curves). A multi-keyframe movement runs with a `linear` timeline and gives each keyframe the curve of the segment
 * that starts there (Web Animations per-keyframe easing). `linear` stays only for pure fades, holds and counters.
 */
export const EASING = {
  /** Arrivals: fast start, long soft stop (the demo's default curve). */
  easeOut: 'cubic-bezier(.2,.7,.2,1)',
  /** Departures and falls: slow start, fast end (the attack dash). */
  easeIn: 'cubic-bezier(.6,0,.9,.5)',
  /** A travel that starts and stops gently (the spotlight's flight in the demo). */
  easeInOut: 'cubic-bezier(.3,0,.2,1)',
  /** A small step back before a dash, then away. */
  anticipate: 'cubic-bezier(.4,-0.45,.6,1)',
  /** A landing that goes a little past its place, then settles (the spotlight's landing in the demo). */
  overshoot: 'cubic-bezier(.3,1.6,.5,1)',
  /** Impacts: almost all the way at once, then a short settle. */
  snap: 'cubic-bezier(.1,.9,.15,1)',
  linear: 'linear',
} as const;

/** A card leaving the hand for the table, at normal speed (was 620): desktop, tablet, landscape. */
export const ENTRANCE_MS = 850;
/** The same flight on the portrait phone table: slower, so a phone renders it smoothly (Root, 2026-11-22). */
export const PHONE_ENTRANCE_MS = 1100;
/**
 * Portrait phone table only: travel motions (card flights, draws, returns to hand, the attack's lift and dash,
 * projectiles and beams) take this much longer. Impacts and number pops keep their time.
 */
export const PHONE_TEMPO = 1.25;
