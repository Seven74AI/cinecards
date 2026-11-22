import type { Catalog, GameEvent, GameState, PlayerId } from '@cinecards/engine';

export interface Fx {
  id: number;
  /** card iid, `slot:<player>:<index>` or `hero:<player>` */
  at: string;
  text: string;
  kind: 'dmg' | 'heal' | 'buff' | 'debuff' | 'status' | 'save' | 'death' | 'play';
}
export interface Beat {
  delay: number;
  fx: Fx[];
  dice?: { value: number; label: string };
  highlight?: { name: string; cardId: string; player: PlayerId };
  sound?: string;
}

let nextId = 1;

/** Turns an event batch into a timeline of animation beats (story 7.2). */
export function eventsToBeats(events: GameEvent[], catalog: Catalog, before: GameState): Beat[] {
  const beats: Beat[] = [];
  let t = 0;
  const push = (b: Omit<Beat, 'delay'>, step = 260) => {
    beats.push({ delay: t, ...b });
    t += step;
  };
  const slotOf = (iid: string): string | null => {
    for (const p of [0, 1] as const) {
      const i = before.players[p].characters.indexOf(iid);
      if (i >= 0) return `slot:${p}:${i}`;
    }
    return null;
  };
  for (const e of events) {
    switch (e.type) {
      case 'damageDealt':
        push({ fx: [{ id: nextId++, at: e.target, text: e.amount > 0 ? `−${e.amount}` : '0', kind: 'dmg' }], sound: 'hit' });
        break;
      case 'healed':
        push({ fx: [{ id: nextId++, at: e.target, text: `+${e.amount}`, kind: 'heal' }], sound: 'heal' });
        break;
      case 'modified':
        if (e.atk || e.hp) {
          const up = e.atk + e.hp >= 0;
          const text = [e.atk ? `${e.atk > 0 ? '+' : ''}${e.atk}⚔` : '', e.hp ? `${e.hp > 0 ? '+' : ''}${e.hp}♥` : ''].filter(Boolean).join(' ');
          push({ fx: [{ id: nextId++, at: e.target, text, kind: up ? 'buff' : 'debuff' }], sound: up ? 'buff' : 'debuff' }, 120);
        }
        break;
      case 'statusApplied':
        push({ fx: [{ id: nextId++, at: e.target, text: '✦', kind: 'status' }], sound: 'status' }, 120);
        break;
      case 'deathPrevented':
        push({ fx: [{ id: nextId++, at: e.iid, text: 'Sauvé !', kind: 'save' }], sound: 'heal' });
        break;
      case 'cardDestroyed': {
        const slot = slotOf(e.iid);
        push({ fx: slot ? [{ id: nextId++, at: slot, text: '', kind: 'death' }] : [], sound: 'death' }, 320);
        break;
      }
      case 'playerDamaged':
        push({ fx: [{ id: nextId++, at: `hero:${e.player}`, text: `−${e.amount}`, kind: 'dmg' }], sound: 'heroHit' });
        break;
      case 'diceRolled':
        push({ fx: [], dice: { value: e.value, label: e.label }, sound: 'dice' }, 1300);
        break;
      case 'cardPlayed': {
        const card = catalog.get(e.cardId);
        if (card?.rarity === 'legendary') push({ fx: [], highlight: { name: card.name, cardId: card.id, player: e.player }, sound: 'legend' }, 1500);
        else push({ fx: [], sound: card?.category === 'spell' ? 'spell' : 'play' }, 150);
        break;
      }
      case 'attackDeclared':
        push({ fx: [], sound: 'swing' }, 180);
        break;
      case 'coinsGained':
      case 'coinBonus':
        push({ fx: [], sound: 'coin' }, 60);
        break;
      case 'turnStarted':
        push({ fx: [], sound: 'turn' }, 60);
        break;
      case 'gameOver':
        push({ fx: [], sound: 'end' }, 0);
        break;
      default:
        break;
    }
  }
  return beats;
}
