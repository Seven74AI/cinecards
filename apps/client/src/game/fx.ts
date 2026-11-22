import type { Catalog, GameEvent, PlayerId } from '@cinecards/engine';

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
  play: 620, // arc from the hand, grows over the slot, lands (story 12.5)
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
 * Story 13.7: on the portrait phone table a spell plays at the demo's pace (scene "Sort"): it flies from the hand
 * (620), grows (300), holds (250), burns (450), then its effect leaves after the label (260) and the orb flies (520).
 */
export const PHONE_SPELL = { fly: 620, grow: 300, hold: 250, burn: 450, label: 260, orb: 520 } as const;
const PHONE_CAST = PHONE_SPELL.fly + PHONE_SPELL.grow + PHONE_SPELL.hold + PHONE_SPELL.burn;

/** Layout-dependent pacing: `phone` is the portrait phone table (story 13.7). */
export interface BeatOptions {
  phone?: boolean;
}

/** Turns an event batch into a timeline of animation beats (stories 7.2, 12.1); `ui/director.ts` stages them. */
export function planBeats(events: GameEvent[], catalog: Catalog, opts: BeatOptions = {}): Beat[] {
  const draws = [0, 0];
  /** Instant spells cast in this batch: their effect (abilityUsed) is paced like the demo's orb on phones. */
  const spells = new Set<string>();
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
        if (card?.rarity === 'legendary') {
          b.highlight = { name: card.name, cardId: card.id, player: e.player };
          b.sound = 'legend';
          b.gap = TIMING.legend;
        } else {
          b.sound = card?.category === 'spell' ? 'spell' : 'play';
          b.gap = e.zone === 'resolved' ? (opts.phone ? PHONE_CAST : TIMING.spellCast) : TIMING.play;
        }
        if (e.zone === 'resolved') spells.add(e.iid);
        break;
      }
      case 'cardDrawn':
        b.sound = 'draw';
        b.gap = draws[e.player]!++ < 2 ? TIMING.draw : TIMING.drawMore;
        break;
      case 'summoned':
        b.sound = 'play';
        b.gap = TIMING.summon;
        break;
      case 'returnedToHand':
        b.gap = TIMING.returned;
        break;
      case 'abilityUsed':
        b.gap = e.trigger === 'attack' || e.trigger === 'reaction' ? TIMING.special : TIMING.ability;
        if (opts.phone && spells.has(e.iid)) b.gap = PHONE_SPELL.label + PHONE_SPELL.orb;
        break;
      case 'attackDeclared':
        b.sound = 'swing';
        b.gap = TIMING.attack;
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
