import type { Ability } from '@cinecards/cards';
import type { PlayerId, QueuedAbility, Target, TriggerKind } from '../types.ts';
import { board, cardOf, isSilenced, onBoard, type Eff, type G } from '../ctx.ts';
import { checkWinner, processDeaths } from './core.ts';
import { runEffects } from './run.ts';
import { targetRequests, type EffectCtx } from './targets.ts';
import { finishEndTurn } from '../turn/turn.ts';
import { offerReaction } from '../play/reactions.ts';

/**
 * Event registry (story 11.4, architecture P1 "Triggers"): every ability kind the engine knows, with the
 * engine event that wakes it. A new trigger is added here (and fired from its event) without touching cards.
 * `label` is the player-facing name (journal, glossary); `fires` says who can trigger it.
 */
export const TRIGGERS: Record<TriggerKind, { label: string; fires: 'player' | 'event' }> = {
  attack: { label: 'Attaque', fires: 'player' },
  active: { label: 'Active', fires: 'player' },
  choice: { label: 'Au choix', fires: 'player' },
  onPlay: { label: 'À l’arrivée', fires: 'event' },
  onAllyPlayed: { label: 'Quand vous posez une carte', fires: 'event' },
  onEnemyPlayed: { label: 'Quand l’adversaire pose une carte', fires: 'event' },
  onDeath: { label: 'À la mort', fires: 'event' },
  startOfTurn: { label: 'Début de votre tour', fires: 'event' },
  endOfTurn: { label: 'Fin de votre tour', fires: 'event' },
  onAttack: { label: 'Quand il attaque', fires: 'event' },
  onAttacked: { label: 'Quand il est attaqué', fires: 'event' },
  onKill: { label: 'Quand il détruit une carte', fires: 'event' },
  reaction: { label: 'Réaction', fires: 'player' },
};

/** Ability kinds that are not triggers but are still valid on a card. */
export const OTHER_KINDS = ['passive', 'flavor'] as const;
export const isKnownKind = (kind: string): boolean => kind in TRIGGERS || (OTHER_KINDS as readonly string[]).includes(kind);

/** Engine events that can wake abilities. */
export type TriggerEvent =
  | { type: 'played'; iid: string; player: PlayerId; option?: number; targets?: Target[] }
  | { type: 'died'; iid: string; owner: PlayerId }
  | { type: 'turnStarted'; player: PlayerId }
  | { type: 'turnEnding'; player: PlayerId }
  | { type: 'killed'; attacker: string; player: PlayerId };

export const queueOf = (g: G): QueuedAbility[] => (g.s.queue ??= []);

/** Effects to run when a card enters play: onPlay abilities, plus active/choice abilities of spells & equipment. */
export function entryEffects(abilities: Ability[], category: string, option: number | undefined): { ability: Ability; index: number; effects: Eff[] }[] {
  const out: { ability: Ability; index: number; effects: Eff[] }[] = [];
  const isSpell = category === 'spell' || category === 'equipment';
  const choices = abilities.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'choice');
  abilities.forEach((ability, index) => {
    if (ability.kind === 'onPlay' || (isSpell && ability.kind === 'active')) out.push({ ability, index, effects: (ability.effects ?? []) as Eff[] });
  });
  if (isSpell && choices.length > 0) {
    const chosen = choices[Math.min(option ?? 0, choices.length - 1)]!;
    out.push({ ability: chosen.a, index: chosen.i, effects: (chosen.a.effects ?? []) as Eff[] });
  }
  return out;
}

function playedMatches(g: G, ab: Ability, played: string): boolean {
  const f = ab.filter;
  if (!f) return true;
  const c = cardOf(g, played);
  if (f.set && c.set !== f.set) return false;
  if (f.category && c.category !== f.category) return false;
  if (f.role && !c.role.includes(f.role)) return false;
  if (f.ids && !f.ids.includes(c.id)) return false;
  return true;
}

/** Abilities of a board card subscribed to `kind` (none while it is silenced). */
function subscribed(g: G, iid: string, kind: TriggerKind): number[] {
  if (isSilenced(g, iid)) return [];
  const out: number[] = [];
  cardOf(g, iid).abilities.forEach((ab, index) => {
    if (ab.kind === kind) out.push(index);
  });
  return out;
}

/** Queues every ability woken by an engine event, in board order. They resolve on the next `drain`. */
export function emit(g: G, ev: TriggerEvent): void {
  const q = queueOf(g);
  switch (ev.type) {
    case 'played': {
      const card = cardOf(g, ev.iid);
      const fromSpell = card.category === 'spell' || card.category === 'equipment';
      for (const { ability, index } of entryEffects(card.abilities, card.category, ev.option)) {
        const trigger: TriggerKind = ability.kind === 'onPlay' ? 'onPlay' : ability.kind === 'choice' ? 'choice' : 'active';
        q.push({
          source: ev.iid,
          ability: index,
          player: ev.player,
          trigger,
          ...(ev.option !== undefined ? { option: ev.option } : {}),
          ...(ev.targets?.length ? { targets: [...ev.targets] } : {}),
          ...(fromSpell ? { fromSpell } : {}),
        });
      }
      for (const b of board(g)) {
        if (b.iid === ev.iid) continue;
        const kind: TriggerKind = b.player === ev.player ? 'onAllyPlayed' : 'onEnemyPlayed';
        for (const index of subscribed(g, b.iid, kind)) {
          if (playedMatches(g, cardOf(g, b.iid).abilities[index]!, ev.iid)) q.push({ source: b.iid, ability: index, player: b.player, trigger: kind });
        }
      }
      return;
    }
    case 'died':
      cardOf(g, ev.iid).abilities.forEach((ab, index) => {
        if (ab.kind === 'onDeath') q.push({ source: ev.iid, ability: index, player: ev.owner, trigger: 'onDeath' });
      });
      return;
    case 'turnStarted':
    case 'turnEnding': {
      const kind: TriggerKind = ev.type === 'turnStarted' ? 'startOfTurn' : 'endOfTurn';
      for (const b of board(g)) if (b.player === ev.player) for (const index of subscribed(g, b.iid, kind)) q.push({ source: b.iid, ability: index, player: b.player, trigger: kind });
      return;
    }
    case 'killed':
      for (const index of subscribed(g, ev.attacker, 'onKill')) q.push({ source: ev.attacker, ability: index, player: ev.player, trigger: 'onKill' });
      return;
  }
}

/** Queues an ability the player just used (active, attack ability, choice of a character). */
export function enqueueUse(g: G, item: QueuedAbility): void {
  queueOf(g).push(item);
}

/**
 * Attack-time triggers (onAttack, onAttacked) resolve on the spot, inside the strike, so they can cancel it.
 * They take no chosen targets.
 */
export function fireNow(g: G, iid: string, kind: 'onAttack' | 'onAttacked', ctx: EffectCtx): void {
  for (const index of subscribed(g, iid, kind)) {
    const ab = cardOf(g, iid).abilities[index]!;
    g.ev.push({ type: 'abilityUsed', iid, ability: index, name: ab.name, player: ctx.player, trigger: kind });
    ctx.label = ab.name;
    runEffects(g, (ab.effects ?? []) as Eff[], ctx);
    if (ctx.cancelAttack) return;
  }
}

const needsOption = (effects: Eff[]): number => {
  for (const e of effects) if (e.op === 'chooseOne' && Array.isArray(e.options)) return e.options.length;
  return 0;
};

/** Is the queued ability still meaningful? Board triggers need their card on the table and not silenced. */
function stillValid(g: G, item: QueuedAbility): boolean {
  if (!g.s.instances[item.source]) return false;
  if (['onPlay', 'onDeath', 'active', 'choice', 'attack'].includes(item.trigger)) return true;
  return !!onBoard(g, item.source) && !isSilenced(g, item.source);
}

const ctxBase = (item: QueuedAbility) => ({ player: item.player, source: item.source, fromSpell: !!item.fromSpell, ...(item.option !== undefined ? { option: item.option } : {}) });

/** Chosen-target requests of a queued ability, in resolution order (empty options included, so indexes line up). */
export function requestsOf(g: G, item: QueuedAbility) {
  const ab = cardOf(g, item.source).abilities[item.ability]!;
  return targetRequests(g, (ab.effects ?? []) as Eff[], ctxBase(item));
}

/** Resolves the head of the queue, or asks its controller to choose first. */
function step(g: G): void {
  const q = queueOf(g);
  const item = q[0]!;
  const ab = cardOf(g, item.source).abilities[item.ability];
  if (!ab || !stillValid(g, item)) {
    q.shift();
    return;
  }
  const effects = (ab.effects ?? []) as Eff[];
  const declared = !!item.targets?.length;
  const choices = needsOption(effects);
  if (!declared && item.option === undefined && choices > 0) {
    g.s.pending = { kind: 'option', player: item.player, source: item.source, ability: item.ability, label: ab.name, trigger: item.trigger, choices };
    g.ev.push({ type: 'targetsOffered', player: item.player, iid: item.source, name: ab.name, trigger: item.trigger });
    return;
  }
  if (!declared && !item.picks) {
    const requests = requestsOf(g, item).map((r) => ({ spec: r.spec, count: Math.min(r.count, r.options.length), min: Math.min(r.min, r.options.length), options: r.options }));
    if (requests.some((r) => r.options.length > 0)) {
      g.s.pending = { kind: 'targets', player: item.player, source: item.source, ability: item.ability, label: ab.name, trigger: item.trigger, requests };
      g.ev.push({ type: 'targetsOffered', player: item.player, iid: item.source, name: ab.name, trigger: item.trigger });
      return;
    }
  }
  q.shift();
  g.ev.push({ type: 'abilityUsed', iid: item.source, ability: item.ability, name: ab.name, player: item.player, trigger: item.trigger });
  const ctx: EffectCtx = { ...ctxBase(item), targets: [...(item.targets ?? [])], label: ab.name };
  if (item.picks) {
    const picks = new Map<Eff, string[][]>();
    requestsOf(g, item).forEach((r, i) => {
      const list = picks.get(r.eff) ?? [];
      list.push(item.picks![i] ?? []);
      picks.set(r.eff, list);
    });
    ctx.picks = picks;
  }
  runEffects(g, effects, ctx);
}

/**
 * Resolves queued abilities until one needs a decision or the queue is empty, then finishes a pending
 * end of turn. Deaths and the winner are checked after each ability.
 */
export function drain(g: G): void {
  for (let guard = 0; guard < 500; guard++) {
    if (g.s.phase === 'finished') {
      g.s.queue = [];
      g.s.endingTurn = false;
      return;
    }
    if (g.s.pending) return;
    if (queueOf(g).length) {
      step(g);
      processDeaths(g);
      checkWinner(g);
      continue;
    }
    if (g.s.endingTurn) {
      g.s.endingTurn = false;
      finishEndTurn(g);
      continue;
    }
    return;
  }
  g.s.queue = []; // safety net against a trigger loop
}

/**
 * Ends an action: deaths, winner, queued triggers, then (if `offer`) a reaction window for the
 * defender when the active player's action is fully resolved and the turn did not pass.
 */
export function settle(g: G, offer: boolean): void {
  const turn = `${g.s.active}:${g.s.players[g.s.active].turnNumber}`;
  processDeaths(g);
  checkWinner(g);
  drain(g);
  if (!offer || g.s.pending || queueOf(g).length) return;
  if (`${g.s.active}:${g.s.players[g.s.active].turnNumber}` !== turn) return;
  offerReaction(g, g.s.active);
}
