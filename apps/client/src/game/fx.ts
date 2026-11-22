import type { Catalog, GameEvent, PlayerId } from '@cinecards/engine';

export interface Fx {
  id: number;
  /** card iid or `hero:<player>` */
  at: string;
  text: string;
  kind: 'dmg' | 'heal' | 'buff' | 'debuff' | 'status' | 'save' | 'death' | 'play';
}

/** One animation "time" (story 12.1): exactly one per engine event, played in order. */
export interface Beat {
  /** Position of the event in its batch. */
  index: number;
  event: GameEvent;
  /** Milliseconds (normal speed) before the next beat starts. */
  gap: number;
  fx: Fx[];
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
  death: 800,
  play: 350,
  legend: 1500,
  summon: 420,
  returned: 450,
  dice: 1300,
  ability: 250,
  special: 600, // glow + beam of a special attack or a reaction
  coin: 60,
  turn: 200,
} as const;

let nextId = 1;

/** Turns an event batch into a timeline of animation beats (stories 7.2, 12.1). */
export function planBeats(events: GameEvent[], catalog: Catalog): Beat[] {
  return events.map((e, index) => {
    const b: Beat = { index, event: e, gap: 0, fx: [] };
    const fx = (at: string, text: string, kind: Fx['kind']) => b.fx.push({ id: nextId++, at, text, kind });
    switch (e.type) {
      case 'damageDealt':
        fx(e.target, e.amount > 0 ? `−${e.amount}` : '0', 'dmg');
        b.sound = 'hit';
        b.gap = TIMING.damage;
        break;
      case 'healed':
        fx(e.target, `+${e.amount}`, 'heal');
        b.sound = 'heal';
        b.gap = TIMING.heal;
        break;
      case 'modified':
        if (e.atk || e.hp) {
          const up = e.atk + e.hp >= 0;
          const text = [e.atk ? `${e.atk > 0 ? '+' : ''}${e.atk}⚔` : '', e.hp ? `${e.hp > 0 ? '+' : ''}${e.hp}♥` : ''].filter(Boolean).join(' ');
          fx(e.target, text, up ? 'buff' : 'debuff');
          b.sound = up ? 'buff' : 'debuff';
          b.gap = TIMING.modify;
        }
        break;
      case 'statusApplied':
        fx(e.target, '✦', 'status');
        b.sound = 'status';
        b.gap = TIMING.status;
        break;
      case 'deathPrevented':
        fx(e.iid, 'Sauvé !', 'save');
        b.sound = 'heal';
        b.gap = TIMING.save;
        break;
      case 'cardDestroyed':
        b.sound = 'death';
        b.gap = TIMING.death;
        break;
      case 'playerDamaged':
        fx(`hero:${e.player}`, `−${e.amount}`, 'dmg');
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
          b.gap = TIMING.play;
        }
        break;
      }
      case 'summoned':
        b.sound = 'play';
        b.gap = TIMING.summon;
        break;
      case 'returnedToHand':
        b.gap = TIMING.returned;
        break;
      case 'abilityUsed':
        b.gap = e.trigger === 'attack' || e.trigger === 'reaction' ? TIMING.special : TIMING.ability;
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
        break;
      default:
        break;
    }
    return b;
  });
}
