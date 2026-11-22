import type { Card } from '@cinecards/cards';

export type PlayerId = 0 | 1;
export type DeckMode = 'shared' | 'randomSplit';
export type SlotKind = 'characters' | 'terrains' | 'spells';
export type Catalog = ReadonlyMap<string, Card>;

export interface Modifier {
  source: string; // instance id of the card granting it, or a rule name
  label: string; // ability name shown to players
  atk: number;
  hp: number;
  turnsLeft?: number; // undefined = permanent; counted down at the end of the owner's turns
}

export interface Status {
  kind: 'silence' | 'poison' | 'shield' | 'immune' | 'insensible' | 'stunned' | 'extraAttack' | 'precision' | 'spellImmune';
  amount?: number; // shield points / poison damage
  turnsLeft?: number; // undefined = permanent
  source: string;
}

export interface CardInstance {
  iid: string;
  cardId: string;
  owner: PlayerId;
  damage: number; // single-body damage taken
  bodyDamage?: number[]; // multi-body cards: damage per body
  modifiers: Modifier[];
  statuses: Status[];
  usedAbilities: number[]; // indexes of active abilities used since played
  playedOnTurn: number; // owner's turn number when it entered the table (0 = not on table)
  attacksUsed: number;
  attackCount?: number; // total attacks since it entered the table (alternating abilities)
  survivals?: number; // times a "survive death" passive was used
  reactedOn?: string; // key of the opponent turn during which it last reacted
  abilityTurns?: Record<number, number>; // ability index -> owner turn it was last used (cooldowns)
}

export interface PlayerState {
  hp: number;
  coins: number;
  coinCap: number;
  turnNumber: number; // this player's own turn counter
  hand: string[];
  graveyard: string[];
  deck: string[]; // own pile (randomSplit mode); unused in shared mode
  characters: (string | null)[];
  terrains: (string | null)[];
  spells: (string | null)[];
  bonusCoins: number; // coins granted for this turn only (may exceed the cap)
  freePlay: boolean; // next card costs nothing
  noTerrainUntil: number; // cannot play terrains while turnNumber <= this
  usedOncePerGame: string[]; // "iid:ability" keys
}

export type Pending =
  | { kind: 'reaction'; player: PlayerId; options: { iid: string; ability: number }[]; key: string }
  | { kind: 'pick'; player: PlayerId; options: string[]; count: number; source: string; label: string };

export interface GameState {
  seed: number;
  rng: number;
  mode: DeckMode;
  active: PlayerId;
  firstPlayer: PlayerId;
  phase: 'main' | 'finished';
  winner: PlayerId | 'draw' | null;
  players: [PlayerState, PlayerState];
  sharedDeck: string[];
  instances: Record<string, CardInstance>;
  nextIid: number;
  pending: Pending | null;
}

export type Target = { kind: 'card'; iid: string } | { kind: 'player'; player: PlayerId };

export type Action =
  | { type: 'playCard'; player: PlayerId; iid: string; slot?: number; targets?: Target[]; option?: number }
  | { type: 'attack'; player: PlayerId; attacker: string; target: Target }
  | { type: 'useAbility'; player: PlayerId; iid: string; ability: number; targets?: Target[]; option?: number }
  | { type: 'react'; player: PlayerId; iid: string; ability: number; target?: Target }
  | { type: 'choose'; player: PlayerId; picks: string[] }
  | { type: 'pass'; player: PlayerId }
  | { type: 'endTurn'; player: PlayerId }
  | { type: 'concede'; player: PlayerId };

export type GameEvent =
  | { type: 'gameStarted'; firstPlayer: PlayerId; mode: DeckMode }
  | { type: 'turnStarted'; player: PlayerId; turnNumber: number }
  | { type: 'coinsGained'; player: PlayerId; amount: number; total: number }
  | { type: 'cardDrawn'; player: PlayerId; iid: string }
  | { type: 'cardBurned'; player: PlayerId; iid: string }
  | { type: 'deckReshuffled'; player: PlayerId | 'shared'; size: number }
  | { type: 'deckEmpty'; player: PlayerId }
  | { type: 'cardPlayed'; player: PlayerId; iid: string; cardId: string; zone: SlotKind | 'resolved'; slot?: number; cost: number }
  | { type: 'attackDeclared'; player: PlayerId; attacker: string; target: Target }
  | { type: 'damageDealt'; source: string; target: string; amount: number; absorbed: number }
  | { type: 'cardDestroyed'; iid: string; owner: PlayerId }
  | { type: 'playerDamaged'; player: PlayerId; amount: number; hp: number }
  | { type: 'turnEnded'; player: PlayerId }
  | { type: 'conceded'; player: PlayerId }
  | { type: 'gameOver'; winner: PlayerId | 'draw' }
  | { type: 'abilityUsed'; iid: string; ability: number; name: string; player: PlayerId }
  | { type: 'modified'; target: string; atk: number; hp: number; label: string }
  | { type: 'statusApplied'; target: string; status: Status['kind']; turns?: number }
  | { type: 'healed'; target: string; amount: number }
  | { type: 'cleansed'; target: string }
  | { type: 'returnedToHand'; iid: string; owner: PlayerId }
  | { type: 'summoned'; iid: string; player: PlayerId; from: string }
  | { type: 'diceRolled'; player: PlayerId; value: number; label: string }
  | { type: 'coinBonus'; player: PlayerId; amount: number }
  | { type: 'cardDiscarded'; player: PlayerId; iid: string }
  | { type: 'deathPrevented'; iid: string; label: string }
  | { type: 'attackCancelled'; attacker: string; label: string }
  | { type: 'reactionOffered'; player: PlayerId }
  | { type: 'reactionPassed'; player: PlayerId }
  | { type: 'pickOffered'; player: PlayerId; count: number }
  | { type: 'picked'; player: PlayerId; count: number }
  | { type: 'chainLimitReached' };

export type ErrorCode =
  | 'GAME_OVER'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'NOT_ENOUGH_COINS'
  | 'SLOT_OCCUPIED'
  | 'WRONG_SLOT'
  | 'NO_FREE_SLOT'
  | 'NOT_ON_BOARD'
  | 'SUMMONING_SICK'
  | 'NO_ATTACK_LEFT'
  | 'TARGET_PROTECTED'
  | 'INVALID_TARGET'
  | 'NOT_SUPPORTED_YET'
  | 'NO_SUCH_ABILITY'
  | 'ABILITY_USED'
  | 'SILENCED'
  | 'STUNNED'
  | 'PENDING_DECISION'
  | 'NOTHING_PENDING'
  | 'INVALID_CHOICE'
  | 'TERRAIN_LOCKED';

export interface RuleError {
  code: ErrorCode;
  params?: Record<string, string | number>;
}

export type ApplyResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: RuleError };
