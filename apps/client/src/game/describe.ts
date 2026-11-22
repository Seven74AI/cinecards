import type { Catalog, GameEvent, GameState, PlayerId, Target } from '@cinecards/engine';

const STATUS_FR: Record<string, string> = {
  silence: 'réduit au silence',
  poison: 'empoisonné',
  shield: 'protégé par un bouclier',
  immune: 'immunisé',
  insensible: 'insensible',
  stunned: 'étourdi',
  extraAttack: 'gagne une attaque',
  precision: 'vise juste',
  spellImmune: 'intouchable par les sorts',
};

export interface Names {
  players: [string, string];
}

/** One French journal line per event (story 5.6). Returns null for events not worth a line. */
export function describeEvent(e: GameEvent, catalog: Catalog, state: GameState, names: Names): string | null {
  const card = (iid: string) => {
    const i = state.instances[iid];
    return (i && catalog.get(i.cardId)?.name) || 'une carte';
  };
  const who = (p: PlayerId) => names.players[p];
  const target = (t: Target) => (t.kind === 'player' ? who(t.player) : card(t.iid));
  switch (e.type) {
    case 'gameStarted':
      return `La partie commence (${e.mode === 'shared' ? 'pioche commune' : 'decks aléatoires'}). ${who(e.firstPlayer)} joue en premier.`;
    case 'turnStarted':
      return `— Tour ${e.turnNumber} de ${who(e.player)} —`;
    case 'coinsGained':
      return `${who(e.player)} reçoit ${e.amount} pièce${e.amount > 1 ? 's' : ''} (${e.total} en stock).`;
    case 'cardDrawn':
      return null;
    case 'cardBurned':
      return `Main pleine : ${card(e.iid)} part au cimetière.`;
    case 'deckReshuffled':
      return `Le cimetière est remélangé dans la pioche (${e.size} cartes).`;
    case 'deckEmpty':
      return `${who(e.player)} ne peut plus piocher.`;
    case 'cardPlayed':
      return `${who(e.player)} joue ${card(e.iid)} (${e.cost} pièce${e.cost > 1 ? 's' : ''}).`;
    case 'attackDeclared':
      return `${card(e.attacker)} attaque ${target(e.target)}.`;
    case 'damageDealt':
      return e.amount > 0 ? `${card(e.target)} subit ${e.amount} dégâts${e.absorbed ? ` (${e.absorbed} absorbés)` : ''}.` : `${card(e.target)} ne subit aucun dégât.`;
    case 'cardDestroyed':
      return `${card(e.iid)} est détruit.`;
    case 'playerDamaged':
      return `${who(e.player)} perd ${e.amount} PV (${e.hp} restants).`;
    case 'turnEnded':
      return null;
    case 'conceded':
      return `${who(e.player)} abandonne.`;
    case 'gameOver':
      return e.winner === 'draw' ? 'Égalité !' : `${who(e.winner)} remporte la partie !`;
    case 'abilityUsed':
      return `${card(e.iid)} : « ${e.name} ».`;
    case 'modified': {
      const parts = [e.atk ? `${e.atk > 0 ? '+' : ''}${e.atk} ATQ` : '', e.hp ? `${e.hp > 0 ? '+' : ''}${e.hp} PV` : ''].filter(Boolean);
      return parts.length ? `${card(e.target)} : ${parts.join(' / ')}.` : null;
    }
    case 'statusApplied':
      return `${card(e.target)} est ${STATUS_FR[e.status] ?? e.status}${e.turns ? ` (${e.turns} tour${e.turns > 1 ? 's' : ''})` : ''}.`;
    case 'healed':
      return `${card(e.target)} récupère ${e.amount} PV.`;
    case 'cleansed':
      return `${card(e.target)} est purifié.`;
    case 'returnedToHand':
      return `${card(e.iid)} retourne dans la main de ${who(e.owner)}.`;
    case 'summoned':
      return `${card(e.iid)} débarque sur la table de ${who(e.player)}.`;
    case 'diceRolled':
      return `Dé (${e.label}) : ${e.value}.`;
    case 'coinBonus':
      return `${who(e.player)} gagne ${e.amount} pièce${e.amount > 1 ? 's' : ''} bonus pour ce tour.`;
    case 'cardDiscarded':
      return `${who(e.player)} défausse ${card(e.iid)}.`;
    case 'deathPrevented':
      return `${card(e.iid)} échappe à la mort (${e.label}).`;
    case 'attackCancelled':
      return `L'attaque de ${card(e.attacker)} est annulée (${e.label}).`;
    case 'reactionOffered':
      return `${who(e.player)} peut réagir…`;
    case 'reactionPassed':
      return null;
    case 'pickOffered':
      return `${who(e.player)} choisit ${e.count} carte${e.count > 1 ? 's' : ''}.`;
    case 'picked':
      return null;
    case 'chainLimitReached':
      return 'Trop d’effets en chaîne : la résolution s’arrête.';
  }
}
