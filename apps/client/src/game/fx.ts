import type { Catalog, GameEvent, PlayerId } from '@cinecards/engine';
import { ENTRANCE_MS, PHONE_ENTRANCE_MS, PHONE_TEMPO } from './motion.ts';
import { removalAt, type Removal } from './removal.ts';

/** One animation "time" (story 12.1): exactly one per engine event, played in order. */
export interface Beat {
  /** Position of the event in its batch. */
  index: number;
  event: GameEvent;
  /** Milliseconds (normal speed) before the next beat starts. */
  gap: number;
  dice?: { value: number; label: string };
  highlight?: { name: string; cardId: string; player: PlayerId };
  sound?: string;
  /**
   * Story 13.10: milliseconds (normal speed) played BEFORE the beat, while the table still shows the state before it:
   * the spotlight of a played card, or the red stamp on my card that an opposing effect removes.
   */
  lead?: number;
  /** Story 13.10: the card is shown in the middle of the table first (a spell, or a card with an "À l'arrivée" effect). */
  spot?: { iid: string; cardId: string; player: PlayerId; ability: number };
  /** Story 13.10: one of the watched players' cards leaves the table because of an opposing effect. */
  removal?: Removal;
}

/** Durations at normal speed, in ms (demo docs/design/animations/demo.html). */
export const TIMING = {
  attack: 390, // lift 220 + dash 170; the impact lands on the next beat
  damage: 300,
  heroDamage: 420,
  heal: 300,
  modify: 200,
  status: 260,
  save: 600,
  death: 1200, // freeze 0.1 + crack 0.2 + shake 0.25 + burn 0.65; the ashes fly during the next beats
  play: ENTRANCE_MS, // step back, arc from the hand, grows over the slot, overshooting landing (stories 12.5, 13.11)
  spellCast: 700, // an instant spell grows over the table and burns
  draw: 420, // deck → hand, then the card turns over; later draws of the same batch overlap
  drawMore: 140,
  legend: 1500,
  summon: 420,
  returned: 500,
  dice: 1300,
  ability: 550, // pulse + label, then the beam or projectile (story 12.6)
  special: 650, // glow + label + beam of a special attack or a reaction
  coin: 60,
  turn: 650, // the turn banner unrolls (story 12.7)
  end: 2000, // victory or defeat moment, before the end screen
} as const;

/**
 * Story 13.10 (demo scenes « Mise en avant » and « Carte retirée »): the spotlight's entry (850, accelerates then
 * overshoots), its panel fading in (300), the 3 s it holds with a draining bar, and its exit (350); the removal's red
 * glow and stamp (260) held before the card leaves (700), the blinking slot (2400) and the alert (4200).
 */
export const SPOT = { enter: 850, panel: 300, hold: 3000, exit: 350 } as const;
export const SPOT_MS = SPOT.enter + SPOT.panel + SPOT.hold + SPOT.exit;
export const REMOVAL = { stamp: 260, hold: 700, ghost: 2400, alert: 4200 } as const;

/**
 * Story 13.7: on the portrait phone table a spell plays at the demo's pace (scene "Sort"): it flies from the hand
 * (620), grows (300), holds (250), burns (450), then its effect leaves after the label (260) and the orb flies (520).
 * Story 13.11: the flight and the orb, travel motions, take the phone tempo on top (`PHONE_TEMPO`).
 */
export const PHONE_SPELL = { fly: 620 * PHONE_TEMPO, grow: 300, hold: 250, burn: 450, label: 260, orb: 520 * PHONE_TEMPO } as const;
const PHONE_CAST = PHONE_SPELL.fly + PHONE_SPELL.grow + PHONE_SPELL.hold + PHONE_SPELL.burn;

/** Layout-dependent pacing: `phone` is the portrait phone table (story 13.7). */
export interface BeatOptions {
  phone?: boolean;
  /** Story 13.10: players whose cards get the removal alert (me; both players in hot seat). */
  alertFor?: readonly PlayerId[];
}

/** Turns an event batch into a timeline of animation beats (stories 7.2, 12.1); `ui/director.ts` stages them. */
export function planBeats(events: GameEvent[], catalog: Catalog, opts: BeatOptions = {}): Beat[] {
  const draws = [0, 0];
  /** Instant spells cast in this batch: their effect (abilityUsed) is paced like the demo's orb on phones. */
  const spells = new Set<string>();
  // story 13.11: on the portrait phone table travel motions take longer (impacts and number pops do not)
  const travel = (ms: number) => (opts.phone ? Math.round(ms * PHONE_TEMPO) : ms);
  // story 13.10: a watched player's card removed by an opposing effect is stamped first, then leaves
  const alert = (b: Beat, index: number) => {
    const r = removalAt(events, index);
    if (!r || !opts.alertFor?.includes(r.owner)) return;
    b.removal = r;
    b.lead = REMOVAL.stamp + REMOVAL.hold;
  };
  return events.map((e, index) => {
    const b: Beat = { index, event: e, gap: 0 };
    switch (e.type) {
      case 'damageDealt':
        b.sound = 'hit';
        b.gap = TIMING.damage;
        break;
      case 'healed':
        b.sound = 'heal';
        b.gap = TIMING.heal;
        break;
      case 'modified':
        if (e.atk || e.hp) {
          const up = e.atk + e.hp >= 0;
          b.sound = up ? 'buff' : 'debuff';
          b.gap = TIMING.modify;
        }
        break;
      case 'statusApplied':
        b.sound = 'status';
        b.gap = TIMING.status;
        break;
      case 'deathPrevented':
        b.sound = 'heal';
        b.gap = TIMING.save;
        break;
      case 'cardDestroyed':
        b.sound = 'death';
        b.gap = TIMING.death;
        alert(b, index);
        break;
      case 'playerDamaged':
        b.sound = 'heroHit';
        b.gap = TIMING.heroDamage;
        break;
      case 'diceRolled':
        b.dice = { value: e.value, label: e.label };
        b.sound = 'dice';
        b.gap = TIMING.dice;
        break;
      case 'cardPlayed': {
        const card = catalog.get(e.cardId);
        // story 13.10: a spell, or a card with an "À l'arrivée" effect, is shown in the middle of the table first
        const ability = !card ? -1 : card.category === 'spell' ? card.abilities.findIndex((a) => a.kind !== 'flavor') : card.abilities.findIndex((a) => a.kind === 'onPlay');
        if (card && ability >= 0) {
          b.spot = { iid: e.iid, cardId: e.cardId, player: e.player, ability };
          b.lead = SPOT_MS;
        }
        if (card?.rarity === 'legendary' && !b.spot) {
          b.highlight = { name: card.name, cardId: card.id, player: e.player };
          b.sound = 'legend';
          b.gap = TIMING.legend;
        } else {
          b.sound = card?.category === 'spell' ? 'spell' : 'play';
          b.gap = e.zone === 'resolved' ? (opts.phone ? PHONE_CAST : TIMING.spellCast) : opts.phone ? PHONE_ENTRANCE_MS : TIMING.play;
        }
        if (e.zone === 'resolved') spells.add(e.iid);
        break;
      }
      case 'cardDrawn':
        b.sound = 'draw';
        b.gap = travel(draws[e.player]!++ < 2 ? TIMING.draw : TIMING.drawMore);
        break;
      case 'summoned':
        b.sound = 'play';
        b.gap = travel(TIMING.summon);
        alert(b, index);
        break;
      case 'returnedToHand':
        b.gap = travel(TIMING.returned);
        alert(b, index);
        break;
      case 'abilityUsed':
        b.gap = travel(e.trigger === 'attack' || e.trigger === 'reaction' ? TIMING.special : TIMING.ability);
        if (opts.phone && spells.has(e.iid)) b.gap = PHONE_SPELL.label + PHONE_SPELL.orb;
        break;
      case 'attackDeclared':
        b.sound = 'swing';
        b.gap = travel(TIMING.attack);
        break;
      case 'coinsGained':
      case 'coinBonus':
        b.sound = 'coin';
        b.gap = TIMING.coin;
        break;
      case 'turnStarted':
        b.sound = 'turn';
        b.gap = TIMING.turn;
        break;
      case 'gameOver':
        b.sound = 'end';
        b.gap = TIMING.end;
        break;
      default:
        break;
    }
    return b;
  });
}
