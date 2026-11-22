import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Card } from '@cinecards/cards';
import {
  abilityTargets,
  attackTargets,
  canAttack,
  computeStats,
  cycleCountdown,
  playTargets,
  RULES,
  type Action,
  type GameState,
  type PlayerId,
  type Target,
} from '@cinecards/engine';
import type { Session } from '../game/session.ts';
import { eventsToBeats, type Fx } from '../game/fx.ts';
import { describeEvent } from '../game/describe.ts';
import { fr } from '../i18n/fr.ts';
import { sfx, isMuted, setMuted } from '../audio/sfx.ts';
import { CardBack, CardView } from './CardView.tsx';
import { CardSheet, choiceLabels, hasChooseOne, type SheetAction } from './CardSheet.tsx';
import { Icon } from './Icon.tsx';
import { Dice } from './Dice.tsx';

type Req = { count: number; options: string[] };
type Mode =
  | { k: 'idle' }
  | { k: 'hand'; iid: string }
  | { k: 'attack'; iid: string; targets: Target[] }
  | { k: 'targets'; base: Action; reqs: Req[]; picked: string[]; label: string };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function useWide() {
  const q = '(min-width: 1100px)';
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Table({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const snap = useSyncExternalStore(session.subscribe, session.get);
  const { state, viewer, names } = snap;
  const catalog = session.catalog;
  const wide = useWide();
  const [mode, setMode] = useState<Mode>({ k: 'idle' });
  const [inspect, setInspect] = useState<string | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const [dice, setDice] = useState<{ value: number; label: string; key: number } | null>(null);
  const [highlight, setHighlight] = useState<{ name: string; cardId: string; key: number } | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [handoffFor, setHandoffFor] = useState<PlayerId | null>(session.kind === 'hotseat' ? viewer : null);
  const [confirmQuit, setConfirmQuit] = useState<null | 'quit' | 'concede'>(null);
  const prevState = useRef<GameState>(state);
  const now = useNow(!!snap.turnEndsAt || !!snap.reactionEndsAt || !!snap.awayUntil);

  // hot-seat: hide the table when the device changes hands
  const lastViewer = useRef(viewer);
  useEffect(() => {
    if (session.kind === 'hotseat' && viewer !== lastViewer.current && state.phase !== 'finished') setHandoffFor(viewer);
    lastViewer.current = viewer;
  }, [viewer, session.kind, state.phase]);

  // refusals → toast (story 5.7)
  useEffect(() => {
    if (!snap.error) return;
    const { code, params } = snap.error.error;
    const fn = fr.errors[code] as (p: Record<string, string | number>) => string;
    setToast({ text: fn ? fn((params ?? {}) as Record<string, string | number>) : code, at: snap.error.at });
    sfx('error');
  }, [snap.error]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // event batch → animation beats (story 7.2); timers survive later batches, cleared on unmount
  const fxTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => fxTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const before = prevState.current;
    prevState.current = state;
    if (snap.seq <= 1) return;
    const beats = eventsToBeats(snap.events, catalog, before);
    const fast = reducedMotion();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        fxTimers.current = fxTimers.current.filter((x) => x !== t);
        fn();
      }, ms);
      fxTimers.current.push(t);
    };
    for (const b of beats) {
      later(() => {
        sfx(b.sound);
        if (b.fx.length) {
          setFx((cur) => [...cur, ...b.fx]);
          const ids = new Set(b.fx.map((f) => f.id));
          later(() => setFx((cur) => cur.filter((f) => !ids.has(f.id))), 1400);
        }
        if (b.dice) setDice({ ...b.dice, key: Date.now() });
        if (b.highlight) setHighlight({ name: b.highlight.name, cardId: b.highlight.cardId, key: Date.now() });
      }, fast ? 0 : b.delay);
    }
  }, [snap.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // reset interaction when the position changes
  useEffect(() => {
    setMode({ k: 'idle' });
  }, [snap.seq]);

  const me = viewer;
  const foe = other(me);
  const myTurn = state.active === me && !state.pending && state.phase === 'main';
  const send = (a: Action) => {
    sfx('click');
    session.send(a);
    setMode({ k: 'idle' });
    setInspect(null);
  };

  const fxAt = (at: string) => fx.filter((f) => f.at === at);
  const nameOf = (iid: string) => catalog.get(state.instances[iid]?.cardId ?? '')?.name ?? '?';

  // ----- starting actions -----
  const startTargets = (base: Action, reqs: Req[], label: string) => {
    const useful = reqs.map((r) => ({ count: Math.min(r.count, r.options.length), options: r.options })).filter((r) => r.count > 0);
    if (!useful.length) return send(base);
    setInspect(null);
    setMode({ k: 'targets', base, reqs: useful, picked: [], label });
  };

  const playFromHand = (iid: string, slot?: number, option?: number) => {
    const base: Action = { type: 'playCard', player: me, iid, ...(slot !== undefined ? { slot } : {}), ...(option !== undefined ? { option } : {}) };
    startTargets(base, playTargets(catalog, state, me, iid, option), `Cible pour ${nameOf(iid)}`);
  };

  const useAbility = (iid: string, ability: number, option?: number) => {
    const base: Action = { type: 'useAbility', player: me, iid, ability, ...(option !== undefined ? { option } : {}) };
    startTargets(base, abilityTargets(catalog, state, me, iid, ability), `Cible pour « ${catalog.get(state.instances[iid]!.cardId)!.abilities[ability]!.name} »`);
  };

  const pickTarget = (iid: string) => {
    if (mode.k !== 'targets') return;
    const picked = mode.picked.includes(iid) ? mode.picked.filter((x) => x !== iid) : [...mode.picked, iid];
    const total = mode.reqs.reduce((s, r) => s + r.count, 0);
    if (picked.length >= total) {
      const targets: Target[] = picked.map((x) => ({ kind: 'card', iid: x }));
      send({ ...mode.base, targets } as Action);
    } else setMode({ ...mode, picked });
  };

  const currentReq = (m: Extract<Mode, { k: 'targets' }>) => {
    let n = m.picked.length;
    for (const r of m.reqs) {
      if (n < r.count) return r;
      n -= r.count;
    }
    return m.reqs[m.reqs.length - 1]!;
  };

  // ----- taps -----
  const tapCard = (iid: string) => {
    const inst = state.instances[iid];
    if (!inst) return;
    if (mode.k === 'targets') {
      if (currentReq(mode).options.includes(iid) || mode.picked.includes(iid)) pickTarget(iid);
      return;
    }
    if (mode.k === 'attack' && mode.targets.some((t) => t.kind === 'card' && t.iid === iid)) {
      return send({ type: 'attack', player: me, attacker: mode.iid, target: { kind: 'card', iid } });
    }
    const P = state.players[inst.owner];
    if (inst.owner === me && P.hand.includes(iid)) {
      setMode(myTurn ? { k: 'hand', iid } : { k: 'idle' });
      setInspect(iid);
      return;
    }
    if (inst.owner === me && P.characters.includes(iid) && myTurn && !canAttack(catalog, state, iid)) {
      setMode({ k: 'attack', iid, targets: attackTargets(catalog, state, iid) });
      setInspect(iid);
      return;
    }
    setMode({ k: 'idle' });
    setInspect(iid);
  };

  const tapSlot = (player: PlayerId, zone: 'characters' | 'terrains' | 'spells', slot: number) => {
    if (mode.k !== 'hand' || player !== me) return;
    const card = catalog.get(state.instances[mode.iid]!.cardId)!;
    const fits = zone === 'characters' ? card.category === 'character' : zone === 'terrains' ? card.category === 'terrain' : card.category === 'spell' || card.category === 'equipment';
    if (!fits) return;
    const choices = card.abilities.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'choice');
    if ((card.category === 'spell' || card.category === 'equipment') && choices.length > 1) {
      setInspect(mode.iid);
      return;
    }
    playFromHand(mode.iid, slot);
  };

  const tapHero = (player: PlayerId) => {
    if (mode.k === 'attack' && mode.targets.some((t) => t.kind === 'player' && t.player === player)) {
      send({ type: 'attack', player: me, attacker: mode.iid, target: { kind: 'player', player } });
    }
  };

  // ----- derived view data -----
  const pileCount = (p: PlayerId) => (state.mode === 'shared' ? state.sharedDeck.length : state.players[p].deck.length);
  const playableSlots = useMemo(() => {
    if (mode.k !== 'hand') return null;
    const c = catalog.get(state.instances[mode.iid]!.cardId)!;
    return c.category === 'character' ? 'characters' : c.category === 'terrain' ? 'terrains' : 'spells';
  }, [mode, catalog, state]);

  const targetable = (iid: string): boolean => {
    if (mode.k === 'attack') return mode.targets.some((t) => t.kind === 'card' && t.iid === iid);
    if (mode.k === 'targets') return currentReq(mode).options.includes(iid) && !mode.picked.includes(iid);
    return false;
  };

  const cardState = (iid: string, owner: PlayerId): 'selected' | 'target' | 'ready' | 'attacker' | null => {
    if (mode.k === 'targets' && mode.picked.includes(iid)) return 'selected';
    if (targetable(iid)) return 'target';
    if ((mode.k === 'attack' && mode.iid === iid) || (mode.k === 'hand' && mode.iid === iid)) return 'attacker';
    if (owner === me && myTurn && state.players[me].characters.includes(iid) && !canAttack(catalog, state, iid)) return 'ready';
    return null;
  };

  const renderBoardCard = (iid: string, owner: PlayerId) => {
    const inst = state.instances[iid]!;
    const card = catalog.get(inst.cardId)!;
    const sick = card.category === 'character' && inst.playedOnTurn >= state.players[owner].turnNumber && canAttack(catalog, state, iid)?.code === 'SUMMONING_SICK';
    return (
      <CardView
        iid={iid}
        card={card}
        stats={card.category === 'character' ? computeStats(catalog, state, iid) : null}
        statuses={inst.statuses}
        sick={!!sick}
        cycle={cycleCountdown(catalog, state, iid)}
        state={cardState(iid, owner)}
        onClick={() => tapCard(iid)}
        fx={fxAt(iid)}
      />
    );
  };

  const Board = ({ player }: { player: PlayerId }) => {
    const P = state.players[player];
    const placing = player === me && playableSlots === 'characters';
    return (
      <div className={'board' + (player === me ? ' mine' : ' theirs')} aria-label={player === me ? 'Ta table' : 'Table adverse'}>
        {P.characters.map((iid, slot) => {
          const deathFx = fxAt(`slot:${player}:${slot}`);
          return (
            <div
              key={slot}
              className={'slot' + (iid ? ' filled' : '') + (placing && !iid ? ' placeable' : '')}
              onClick={() => (!iid ? tapSlot(player, 'characters', slot) : undefined)}
              role={!iid && placing ? 'button' : undefined}
              aria-label={!iid ? `Socle ${ROMAN[slot]}` : undefined}
            >
              <span className="rune-ring" aria-hidden="true" />
              {!iid ? <span className="slot-num">{ROMAN[slot]}</span> : renderBoardCard(iid, player)}
              {deathFx.map((f) => (
                <span key={f.id} className="fx-death" aria-hidden="true" />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const Zones = ({ player }: { player: PlayerId }) => {
    const P = state.players[player];
    const zone = (kind: 'terrains' | 'spells') => (
      <div className={'zone ' + kind}>
        {P[kind].map((iid, slot) => {
          const placing = player === me && playableSlots === kind && !iid;
          if (!iid)
            return (
              <span
                key={slot}
                className={(kind === 'terrains' ? 'seal' : 'rune') + (placing ? ' placeable' : '')}
                onClick={() => tapSlot(player, kind, slot)}
                role={placing ? 'button' : undefined}
                aria-label={kind === 'terrains' ? 'Socle terrain' : 'Socle sort'}
              >
                <Icon name={kind === 'terrains' ? 'terrain' : 'spell'} size={12} color="rgba(212,167,74,.45)" />
              </span>
            );
          const card = catalog.get(state.instances[iid]!.cardId)!;
          return (
            <button key={slot} type="button" className={(kind === 'terrains' ? 'seal' : 'rune') + ' filled' + (targetable(iid) ? ' is-target' : '')} onClick={() => tapCard(iid)} title={card.name}>
              <MiniArt card={card} />
            </button>
          );
        })}
      </div>
    );
    return (
      <div className="zones">
        {zone('terrains')}
        {zone('spells')}
      </div>
    );
  };

  const Hero = ({ player }: { player: PlayerId }) => {
    const P = state.players[player];
    const canHit = mode.k === 'attack' && mode.targets.some((t) => t.kind === 'player' && t.player === player);
    const active = state.active === player;
    return (
      <div className={'hero' + (canHit ? ' is-target' : '') + (active ? ' active' : '')} onClick={() => tapHero(player)} role={canHit ? 'button' : undefined}>
        <span className="avatar">{names[player].slice(0, 1).toUpperCase()}</span>
        <div className="hero-main">
          <div className="hero-line">
            <span className="hero-name">{names[player]}</span>
            <span className="hero-hp">
              <Icon name="heart" size={12} color="#FF8A8A" /> {P.hp} / {RULES.PLAYER_HP}
            </span>
          </div>
          <div className="hpbar">
            <div style={{ width: `${Math.max(0, (P.hp / RULES.PLAYER_HP) * 100)}%` }} />
          </div>
        </div>
        <span className="hero-coins" title={`Stock max ${P.coinCap}${P.bonusCoins ? `, dont ${P.bonusCoins} bonus` : ''}`}>
          <span className="coin small" />
          {P.coins}
          <small>/{P.coinCap}</small>
        </span>
        <span className="hero-counts">
          <span title="Main">
            <Icon name="hand" size={12} /> {P.hand.length}
          </span>
          <span title="Pioche">
            <Icon name="deck" size={12} /> {pileCount(player)}
          </span>
          <span title="Cimetière">
            <Icon name="grave" size={12} /> {P.graveyard.length}
          </span>
        </span>
        {fxAt(`hero:${player}`).map((f) => (
          <span key={f.id} className={`fx fx-${f.kind}`}>
            {f.text}
          </span>
        ))}
      </div>
    );
  };

  // ----- banner -----
  const secondsLeft = snap.turnEndsAt ? Math.max(0, Math.ceil((snap.turnEndsAt - now) / 1000)) : null;
  const banner = (() => {
    if (state.phase === 'finished') return { title: 'Fin de la partie', sub: '' };
    if (mode.k === 'targets') {
      const total = mode.reqs.reduce((s, r) => s + r.count, 0);
      return { title: mode.label, sub: `${mode.picked.length}/${total} — touche une carte qui brille` };
    }
    if (mode.k === 'attack') return { title: `${nameOf(mode.iid)} attaque`, sub: mode.targets.length ? 'Touche une cible' : 'Aucune cible' };
    if (mode.k === 'hand') return { title: nameOf(mode.iid), sub: 'Touche un socle libre ou « Jouer »' };
    if (state.pending && state.pending.player !== me) return { title: 'Réaction adverse…', sub: `${names[foe]} réfléchit` };
    if (state.active === me) return { title: `Ton tour ${state.players[me].turnNumber}`, sub: 'Pose, attaque, puis termine ton tour' };
    return { title: `Tour de ${names[foe]}`, sub: session.kind === 'bot' ? 'Le Grimoire tourne ses pages…' : 'Patiente…' };
  })();

  // ----- sheet actions -----
  const sheetActions: SheetAction[] = [];
  if (inspect && state.instances[inspect]) {
    const inst = state.instances[inspect]!;
    const card = catalog.get(inst.cardId)!;
    if (inst.owner === me && state.players[me].hand.includes(inspect) && myTurn) {
      const choices = card.abilities.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'choice');
      const afford = (card.cost ?? 0) <= state.players[me].coins || state.players[me].freePlay;
      if ((card.category === 'spell' || card.category === 'equipment') && choices.length > 1)
        choices.forEach(({ a }, o) => sheetActions.push({ label: `Jouer : ${a.name}`, primary: true, disabled: !afford, onClick: () => playFromHand(inspect, undefined, o) }));
      else sheetActions.push({ label: afford ? `Jouer (${card.cost ?? 0} pièces)` : `Il manque ${(card.cost ?? 0) - state.players[me].coins} pièces`, primary: true, disabled: !afford, onClick: () => playFromHand(inspect) });
    }
    if (mode.k === 'attack' && mode.iid === inspect) {
      sheetActions.push({ label: 'Choisir une cible', primary: true, onClick: () => setInspect(null) });
    }
  }

  const sheet = inspect ? (
    <CardSheet
      catalog={catalog}
      state={state}
      iid={inspect}
      viewer={me}
      actions={sheetActions}
      onUseAbility={(index, option) => {
        const card = catalog.get(state.instances[inspect]!.cardId)!;
        if (hasChooseOne(card, index) && option === undefined) return;
        useAbility(inspect, index, option);
      }}
      onClose={() => {
        setInspect(null);
        if (mode.k === 'hand') setMode({ k: 'idle' });
      }}
      docked={wide}
    />
  ) : null;

  // ----- journal -----
  const journal = (
    <div className="journal parchment-dark">
      <div className="journal-head">
        <Icon name="book" size={14} /> Journal
        {!wide ? (
          <button type="button" className="icon-btn" onClick={() => setJournalOpen(false)} aria-label="Fermer le journal">
            <Icon name="close" size={16} />
          </button>
        ) : null}
      </div>
      <JournalList snapLog={snap.log} describe={(e, s) => describeEvent(e, catalog, s, { players: names })} />
    </div>
  );

  const hand = state.players[me].hand;
  const foeHand = state.players[foe].hand.length;
  const pending = state.pending;

  return (
    <div className={'table-root' + (wide ? ' wide' : '')}>
      <Ambient />
      {wide ? <div className="col-left">{journal}</div> : null}
      <main className="table">
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={() => setConfirmQuit('quit')} aria-label="Quitter">
            <Icon name="flag" size={16} />
          </button>
          {snap.roomCode ? <span className="room-code">Salle {snap.roomCode}</span> : <span className="room-code">CineCards</span>}
          <span className="spacer" />
          {!wide ? (
            <button type="button" className="icon-btn" onClick={() => setJournalOpen(true)} aria-label="Journal">
              <Icon name="book" size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
          >
            <Icon name={muted ? 'mute' : 'sound'} size={16} />
          </button>
        </div>

        {Hero({ player: foe })}
        <div className="foe-hand" aria-label={`${foeHand} cartes en main`}>
          {Array.from({ length: Math.min(foeHand, 10) }, (_, i) => (
            <CardBack key={i} small />
          ))}
        </div>
        {Zones({ player: foe })}
        {Board({ player: foe })}

        <div className="banner parchment">
          <span className="orn" />
          <div className="banner-text">
            <strong>{banner.title}</strong>
            <span>{banner.sub}</span>
          </div>
          {secondsLeft !== null && state.phase === 'main' ? <span className={'timer' + (secondsLeft <= 10 ? ' low' : '')}>{secondsLeft}s</span> : null}
          {mode.k !== 'idle' ? (
            <button type="button" className="btn small ghost" onClick={() => setMode({ k: 'idle' })}>
              Annuler
            </button>
          ) : (
            <button type="button" className="btn small primary" disabled={!myTurn} onClick={() => send({ type: 'endTurn', player: me })}>
              Fin du tour
            </button>
          )}
        </div>

        {Board({ player: me })}
        {Zones({ player: me })}
        {Hero({ player: me })}
        <div className="hand" aria-label="Ta main">
          {hand.map((iid) => {
            const inst = state.instances[iid];
            if (!inst) return null;
            const card = catalog.get(inst.cardId)!;
            const afford = (card.cost ?? 0) <= state.players[me].coins || state.players[me].freePlay;
            return (
              <CardView
                key={iid}
                iid={iid}
                card={card}
                size="hand"
                cost={state.players[me].freePlay ? 0 : undefined}
                state={mode.k === 'hand' && mode.iid === iid ? 'selected' : myTurn && afford ? 'ready' : myTurn ? 'disabled' : null}
                onClick={() => tapCard(iid)}
              />
            );
          })}
          {hand.length === 0 ? <span className="muted">Main vide</span> : null}
        </div>
      </main>
      {wide ? <div className="col-right">{sheet ?? <div className="inspector-empty parchment-dark">Touche une carte pour voir ses détails.</div>}</div> : sheet}
      {!wide && journalOpen ? <div className="drawer">{journal}</div> : null}

      {pending && pending.player === me && pending.kind === 'pick' ? (
        <PickModal
          key={snap.seq}
          options={pending.options}
          count={pending.count}
          label={pending.label}
          render={(iid) => catalog.get(state.instances[iid]?.cardId ?? '')}
          onDone={(picks) => send({ type: 'choose', player: me, picks })}
        />
      ) : null}
      {pending && pending.player === me && pending.kind === 'reaction' && handoffFor === null ? (
        <ReactionModal
          options={pending.options.map((o) => ({ ...o, name: nameOf(o.iid), ability: o.ability, abilityName: catalog.get(state.instances[o.iid]!.cardId)!.abilities[o.ability]!.name }))}
          targets={attackTargetsFor(state, foe)}
          nameOf={(t) => (t.kind === 'player' ? names[t.player] : nameOf(t.iid))}
          secondsLeft={snap.reactionEndsAt ? Math.max(0, Math.ceil((snap.reactionEndsAt - now) / 1000)) : null}
          onReact={(iid, ability, target) => send({ type: 'react', player: me, iid, ability, target })}
          onPass={() => send({ type: 'pass', player: me })}
        />
      ) : null}

      {dice ? <Dice key={dice.key} value={dice.value} label={dice.label} onDone={() => setDice(null)} /> : null}
      {highlight ? <Highlight key={highlight.key} name={highlight.name} cardId={highlight.cardId} catalog={catalog} onDone={() => setHighlight(null)} /> : null}
      {toast ? (
        <div className="toast" role="alert" key={toast.at}>
          {toast.text}
        </div>
      ) : null}
      {snap.reconnecting ? (
        <div className="toast info" role="status">
          Reconnexion…
        </div>
      ) : null}
      {snap.status === 'opponentAway' ? (
        <div className="toast info" role="status">
          {names[foe]} s’est absenté·e{snap.awayUntil ? ` — victoire par forfait dans ${Math.max(0, Math.ceil((snap.awayUntil - now) / 1000))}s` : ''}
        </div>
      ) : null}
      {handoffFor !== null && session.kind === 'hotseat' ? (
        <div className="overlay handoff">
          <div className="parchment card-panel">
            <h2>Au tour de {names[handoffFor]}</h2>
            <p>Passe l’appareil à {names[handoffFor]}. Ses cartes restent cachées jusqu’à ce qu’il ou elle soit prêt·e.</p>
            <button type="button" className="btn primary" onClick={() => setHandoffFor(null)}>
              Je suis prêt·e
            </button>
          </div>
        </div>
      ) : null}
      {state.phase === 'finished' ? <EndScreen state={state} me={me} names={names} kind={session.kind} onLeave={onLeave} /> : null}
      {confirmQuit === 'quit' ? (
        <div className="overlay">
          <div className="parchment card-panel">
            <h2>Quitter la partie ?</h2>
            <p>
              {state.phase === 'finished'
                ? 'Retour à l’accueil.'
                : session.kind === 'online'
                  ? `Tu pourras revenir pendant ${RULES.RECONNECT_SECONDS} s avec le code ${snap.roomCode ?? ''}. Passé ce délai, ${names[foe]} gagne par forfait.`
                  : 'Retour à l’accueil : cette partie ne sera pas conservée.'}
            </p>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setConfirmQuit(null)}>
                Rester
              </button>
              {state.phase !== 'finished' ? (
                <button type="button" className="btn ghost" onClick={() => setConfirmQuit('concede')}>
                  Abandonner
                </button>
              ) : null}
              <button type="button" className="btn primary" onClick={onLeave}>
                Quitter
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmQuit === 'concede' ? (
        <div className="overlay">
          <div className="parchment card-panel">
            <h2>Abandonner la partie ?</h2>
            <p>{names[foe]} gagne immédiatement. Tu ne pourras pas revenir.</p>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setConfirmQuit(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setConfirmQuit(null);
                  if (state.phase !== 'finished') session.send({ type: 'concede', player: me });
                }}
              >
                Abandonner
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function attackTargetsFor(state: GameState, foe: PlayerId): Target[] {
  const chars = state.players[foe].characters.filter((x): x is string => !!x);
  return chars.length ? chars.map((iid) => ({ kind: 'card', iid })) : [{ kind: 'player', player: foe }];
}

function MiniArt({ card }: { card: Card }) {
  return <CardView card={card} size="board" />;
}

function JournalList({ snapLog, describe }: { snapLog: { seq: number; event: import('@cinecards/engine').GameEvent; state: GameState }[]; describe: (e: import('@cinecards/engine').GameEvent, s: GameState) => string | null }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [snapLog.length]);
  return (
    <ol className="journal-list" ref={ref}>
      {snapLog.map((l, i) => {
        const text = describe(l.event, l.state);
        if (!text) return null;
        return (
          <li key={i} className={l.event.type === 'turnStarted' ? 'turn' : l.event.type === 'gameOver' ? 'over' : ''}>
            {text}
          </li>
        );
      })}
    </ol>
  );
}

function PickModal({ options, count, label, render, onDone }: { options: string[]; count: number; label: string; render: (iid: string) => Card | undefined; onDone: (picks: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const need = Math.min(count, options.length);
  return (
    <div className="overlay">
      <div className="parchment card-panel wide">
        <h2>{label}</h2>
        <p>
          Garde {need} carte{need > 1 ? 's' : ''} ({picked.length}/{need}).
        </p>
        <div className="pick-grid">
          {options.map((iid) => {
            const c = render(iid);
            return c ? (
              <CardView
                key={iid}
                card={c}
                size="hand"
                state={picked.includes(iid) ? 'selected' : null}
                onClick={() => setPicked((p) => (p.includes(iid) ? p.filter((x) => x !== iid) : p.length < need ? [...p, iid] : p))}
              />
            ) : null;
          })}
        </div>
        <button type="button" className="btn primary" disabled={picked.length !== need} onClick={() => onDone(picked)}>
          Garder
        </button>
      </div>
    </div>
  );
}

function ReactionModal({
  options,
  targets,
  nameOf,
  secondsLeft,
  onReact,
  onPass,
}: {
  options: { iid: string; ability: number; name: string; abilityName: string }[];
  targets: Target[];
  nameOf: (t: Target) => string;
  secondsLeft: number | null;
  onReact: (iid: string, ability: number, target: Target) => void;
  onPass: () => void;
}) {
  const o = options[0]!;
  return (
    <div className="overlay reaction">
      <div className="parchment card-panel">
        <h2>Réaction possible !</h2>
        <p>
          {o.name} peut utiliser « {o.abilityName} » pendant le tour adverse.{secondsLeft !== null ? ` (${secondsLeft}s)` : ''}
        </p>
        <div className="target-list">
          {targets.map((t, i) => (
            <button key={i} type="button" className="btn" onClick={() => onReact(o.iid, o.ability, t)}>
              Frapper {nameOf(t)}
            </button>
          ))}
        </div>
        <button type="button" className="btn ghost" onClick={onPass}>
          Laisser passer
        </button>
      </div>
    </div>
  );
}

function Highlight({ name, cardId, catalog, onDone }: { name: string; cardId: string; catalog: import('@cinecards/engine').Catalog; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), reducedMotion() ? 900 : 1600);
    return () => clearTimeout(t);
  }, []);
  const card = catalog.get(cardId);
  return (
    <div className="overlay highlight" onClick={onDone}>
      <div className="highlight-inner">
        {card ? <CardView card={card} size="big" /> : null}
        <div className="highlight-name">{name}</div>
        <div className="highlight-sub">Légendaire</div>
      </div>
    </div>
  );
}

function EndScreen({ state, me, names, kind, onLeave }: { state: GameState; me: PlayerId; names: [string, string]; kind: string; onLeave: () => void }) {
  const w = state.winner;
  const title = w === 'draw' ? 'Égalité' : kind === 'hotseat' ? `${names[w as PlayerId]} gagne !` : w === me ? 'Victoire !' : 'Défaite…';
  return (
    <div className="overlay end">
      <div className="parchment card-panel">
        <Icon name="crown" size={40} color="#8A6416" />
        <h2>{title}</h2>
        <p>
          {names[0]} : {state.players[0].hp} PV · {names[1]} : {state.players[1].hp} PV
        </p>
        <p className="muted">
          {state.players[0].turnNumber + state.players[1].turnNumber} tours joués
        </p>
        <button type="button" className="btn primary" onClick={onLeave}>
          Retour à l’accueil
        </button>
      </div>
    </div>
  );
}

function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="ember" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
      ))}
    </div>
  );
}

export { choiceLabels };
