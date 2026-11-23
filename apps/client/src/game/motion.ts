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

/**
 * Story 13.13 (mockup approved by Root, 2026-11-23): a travel motion lasts its usual time × `travelFactor`, so a
 * short hop is quicker and a trip across the table slower, within these bounds.
 */
export const TRAVEL_BOUNDS = { min: 0.7, max: 1.4 } as const;
/**
 * Typical distances on screen (px, measured on the `pose` dev scene) at which a motion keeps its usual time:
 * `attack` the dash, `fly` a card to its slot (also back to hand), `draw` deck → hand, `effect` a beam, an orb, ashes.
 * `desk`: every layout but the portrait phone table (`phone`, the compact table).
 */
export const TRAVEL_REF = {
  desk: { attack: 300, fly: 550, draw: 600, effect: 300 },
  phone: { attack: 210, fly: 320, draw: 200, effect: 270 },
} as const;
export type TravelKind = keyof (typeof TRAVEL_REF)['desk'];

/** How much longer than usual a motion over `distance` px takes: distance / reference, bounded. */
export function travelFactor(distance: number, ref: number): number {
  if (!(distance > 0) || !(ref > 0)) return 1;
  return Math.min(TRAVEL_BOUNDS.max, Math.max(TRAVEL_BOUNDS.min, distance / ref));
}

/**
 * Story 13.14 (mockup approved by Root, 2026-11-23): effects on a card (numbers, impact star, particles, stat arrows)
 * are drawn at the scale of the card: its width ÷ the demo's 100 px card, bounded. Numbers keep a legible size.
 */
export const FX_SCALE = { ref: 100, min: 0.45, max: 1.3 } as const;
export const FX_MIN_FONT = 11;
export function fxScale(width: number): number {
  if (!(width > 0)) return 1;
  return Math.min(FX_SCALE.max, Math.max(FX_SCALE.min, width / FX_SCALE.ref));
}

/**
 * Story 13.15 (mockup approved by Root, 2026-11-23): the table shakes in proportion to the screen. The approved demo's
 * shake is kept on a 390 px phone; the factor is the short side of the screen over that, bounded.
 */
export const SHAKE_SCALE = { ref: 390, min: 0.4, max: 2 } as const;
export function shakeScale(width: number, height: number): number {
  const side = Math.min(width, height);
  if (!(side > 0)) return 1;
  return Math.min(SHAKE_SCALE.max, Math.max(SHAKE_SCALE.min, side / SHAKE_SCALE.ref));
}
