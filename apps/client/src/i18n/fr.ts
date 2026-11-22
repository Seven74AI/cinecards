import type { ErrorCode } from '@cinecards/protocol';

/** Every player-facing French string. Code stays in English. */
export const fr = {
  appTitle: 'CineCards',
  comingSoon: 'La table de jeu arrive bientôt.',
  errors: {
    GAME_OVER: () => 'La partie est terminée.',
    NOT_YOUR_TURN: () => "Ce n'est pas ton tour.",
    CARD_NOT_IN_HAND: () => "Cette carte n'est pas dans ta main.",
    NOT_ENOUGH_COINS: (p) => `Pas assez de pièces : ${p.cost} requises, ${p.coins} en stock.`,
    SLOT_OCCUPIED: () => 'Ce socle est déjà occupé.',
    WRONG_SLOT: () => 'Cette carte ne va pas dans ce socle.',
    NO_FREE_SLOT: () => 'Plus aucun socle libre pour cette carte.',
    NOT_ON_BOARD: () => "Cette carte n'est pas sur ta table.",
    SUMMONING_SICK: () => 'Cette carte vient d’arriver : elle attaquera au prochain tour.',
    NO_ATTACK_LEFT: () => 'Cette carte a déjà attaqué ce tour-ci.',
    TARGET_PROTECTED: () => 'Ton adversaire est protégé par ses personnages.',
    INVALID_TARGET: () => 'Cible impossible.',
    NOT_SUPPORTED_YET: () => 'Cette action n’est pas encore disponible.',
    NO_SUCH_ABILITY: () => 'Cette carte n’a pas cette capacité.',
    ABILITY_USED: () => 'Capacité déjà utilisée.',
    SILENCED: () => 'Cette carte est réduite au silence.',
    STUNNED: () => 'Cette carte est étourdie : elle ne peut pas attaquer ce tour-ci.',
    PENDING_DECISION: () => 'Une décision est en attente.',
    NOTHING_PENDING: () => 'Aucune décision en attente.',
    INVALID_CHOICE: () => 'Choix impossible.',
    TERRAIN_LOCKED: () => 'Impossible de poser un terrain ce tour-ci.',
  } satisfies Record<ErrorCode, (params: Record<string, string | number>) => string>,
};
