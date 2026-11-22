/** Rule constants from the GDD — the single source of truth for numbers. */
export const RULES = {
  STARTING_HAND: 7,
  PLAYER_HP: 700,
  MAX_HAND: 10,
  INCOME_CAP: 10,
  COIN_CAP: 10,
  CHARACTER_SLOTS: 10,
  TERRAIN_SLOTS: 5,
  SPELL_SLOTS: 5,
  ATTACKS_PER_TURN: 1,
  DAMAGE_ROUNDING: 10,
  CHAIN_LIMIT: 50,
  TURN_SECONDS: 75,
  REACTION_SECONDS: 5,
  RECONNECT_SECONDS: 90,
} as const;
