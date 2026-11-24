import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Card } from '@cinecards/cards';
import {
  attackTargets,
  canAttack,
  computeStats,
  cycleCountdown,
  RULES,
  type Action,
  type GameState,
  type PlayerId,
  type Target,
} from '@cinecards/engine';
import type { Session } from '../game/session.ts';
import { loadSpeed, Playback, saveSpeed, SPEED_FR, SPEEDS, type AnimSpeed, type Cue } from '../game/playback.ts';
import { clearLeads, direct, noteHand } from './director.ts';
import { revealInRow } from './handScroll.ts';
import { removalAt } from '../game/removal.ts';
import { Counter } from './Counter.tsx';
import { describeEvent, triggerPhrase } from '../game/describe.ts';
import { fr } from '../i18n/fr.ts';
import { sfx, isMuted, setMuted } from '../audio/sfx.ts';
import { CardBack, CardView } from './CardView.tsx';
import { FullCard } from './Abilities.tsx';
import { getHandView, subscribeHandView } from '../game/handView.ts';
import { SettingsButton } from './Settings.tsx';
import { sortHand } from '../game/handOrder.ts';
import { useRefs } from './Refs.tsx';
import { CardSheet, choiceLabels, hasChooseOne, type SheetAction } from './CardSheet.tsx';
import { modifierLines, type ModifierLine } from '../game/modifiers.ts';
import { SourceLines, type SourceLink } from './SourceLines.tsx';
import { Icon } from './Icon.tsx';
import { Dice } from './Dice.tsx';
import { EmoteBubbles, EmoteButton } from './Emotes.tsx';
import type { EmoteId } from '@cinecards/protocol';

/** One target request of a prompt; `index` is its position in the engine's request list. */
type Req = { count: number; min: number; options: string[]; index: number };
type Mode =
  | { k: 'idle' }
  | { k: 'hand'; iid: string }
  | { k: 'attack'; iid: string; targets: Target[] }
  | { k: 'targets'; total: number; reqs: Req[]; picked: string[][]; label: string };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/**
 * The clock of the countdowns. Story 13.12: the table renders again only when a shown second changes (it was
 * every 500 ms, a whole table render each time, also in the middle of an animation).
 */
function useNow(deadlines: readonly (number | null | undefined)[]) {
  const ds = deadlines.filter((d): d is number => !!d);
  const key = ds.join(',');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ds.length) return;
    const secs = (t: number) => ds.map((d) => Math.ceil((d - t) / 1000)).join(',');
    let shown = secs(Date.now());
    setNow(Date.now());
    const t = setInterval(() => {
      const n = Date.now();
      const s = secs(n);
      if (s === shown) return;
      shown = s;
      setNow(n);
    }, 200);
    return () => clearInterval(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return now;
}

/** Runs `fn` at the next frame (or after 100 ms if no frame comes, e.g. the tab was just hidden), once. */
function nextFrame(fn: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  setTimeout(run, 100);
}

function useMedia(q: string) {
  const [on, setOn] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const up = () => setOn(m.matches);
    m.addEventListener('change', up);
    return () => m.removeEventListener('change', up);
  }, [q]);
  return on;
}

/**
 * Story 13.2: portrait phones get the compact table; landscape, tablets and desktop keep theirs. Story 14.1: both
 * sides are always shown whole (no zoom, no fold).
 */
const COMPACT_QUERY = '(orientation: portrait) and (max-width: 699px)';

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

/**
 * Story 14.3: the open hand of the compact table. In the detailed view it is as tall as the tallest full card it holds
 * plus its padding (measured again when the hand changes, a card's size changes or the window is resized), so no card
 * scrolls vertically; it grows upward over my side, the turn banner and the foe's side, never over the foe's banner.
 */
function HandPanel({ detailed, handKey, children }: { detailed: boolean; handKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    const row = panel?.firstElementChild as HTMLElement | null;
    if (!panel || !row) return;
    if (!detailed) {
      panel.style.removeProperty('height');
      return;
    }
    const fit = () => {
      const cards = [...row.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('card'));
      const tallest = Math.max(0, ...cards.map((c) => c.offsetHeight));
      const cs = getComputedStyle(row);
      const want = (tallest || 60) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      // the room above the bottom of my side, up to the foe's banner (a small gap keeps its glow in view)
      const foe = panel.closest('.table')?.querySelector<HTMLElement>('.hero');
      const room = foe ? panel.getBoundingClientRect().bottom - foe.getBoundingClientRect().bottom - 4 : want;
      panel.style.height = `${Math.round(Math.min(want, room))}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    for (const c of row.children) ro.observe(c);
    addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      removeEventListener('resize', fit);
    };
  }, [detailed, handKey]);
  // story 14.6: a card that arrives in the open hand (draw, back to hand) is scrolled into view; not when the hand
  // opens, nor when its cards only change order or leave
  const seen = useRef<Set<string> | null>(null);
  useLayoutEffect(() => {
    const ids = handKey ? handKey.split(',') : [];
    const before = seen.current;
    seen.current = new Set(ids);
    if (!before) return;
    const last = ids.filter((iid) => !before.has(iid)).pop();
    const el = last ? ref.current?.querySelector<HTMLElement>(`.card[data-iid="${CSS.escape(last)}"]`) : null;
    if (el) revealInRow(el);
  }, [handKey]);
  return (
    <div ref={ref} className={'hand hand-panel' + (detailed ? ' detailed' : '')} id="cc-hand" role="region" aria-label="Ta main">
      <div className="hand-row">{children}</div>
    </div>
  );
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Table({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const snap = useSyncExternalStore(session.subscribe, session.get);
  const { state, viewer, names } = snap;
  const catalog = session.catalog;
  const wide = useWide();
  const compact = useMedia(COMPACT_QUERY) && !wide;
  const [mode, setMode] = useState<Mode>({ k: 'idle' });
  /** Story 14.2: on the compact table my hand is folded behind the fan button of my banner; this opens it. */
  const [handOpen, setHandOpen] = useState(false);
  /** Story 14.3: compact (14.2, default) or detailed open hand; story 14.4 sets it from "Réglages". */
  const handView = useSyncExternalStore(subscribeHandView, getHandView);
  const detailedHand = compact && handView === 'detailed';
  // story 14.4: seven 44 px buttons and a room code do not fit a 360 px phone; online, the speed goes into Réglages
  const speedInSettings = compact && !!session.sendEmote;
  const [inspect, setInspect] = useState<string | null>(null);
  /** Story 13.9: lines to a modifier's sources, shown on demand for a moment (`tuck`: the sheet slides away meanwhile). */
  const [lines, setLines] = useState<{ target: string; links: SourceLink[]; tuck: boolean; key: number } | null>(null);
  const { openRules, previewId } = useRefs();
  /** Story 13.1: the slot of a card cited in an open preview glows. */
  const cited = (iid: string | null) => (iid && previewId && shown.instances[iid]?.cardId === previewId ? ' ref-glow' : '');
  const [journalOpen, setJournalOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);
  const [dice, setDice] = useState<{ value: number; label: string; key: number } | null>(null);
  const [highlight, setHighlight] = useState<{ name: string; cardId: string; key: number } | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [handoffFor, setHandoffFor] = useState<PlayerId | null>(session.kind === 'hotseat' ? viewer : null);
  const [confirmQuit, setConfirmQuit] = useState<null | 'quit' | 'concede'>(null);
  const prevState = useRef<GameState>(state);
  // presentation layer (story 12.1): the board shows `shown`, replayed beat by beat; rules and taps use `state`
  const [pb] = useState(() => new Playback(catalog, state, loadSpeed()));
  // story 13.7: spells take the demo's time on the portrait phone table (set before the next batch is planned)
  pb.phone = compact;
  // story 13.10: my cards get the removal alert (both players' in hot seat); names for the spotlight and the alert
  const alertFor = useMemo<PlayerId[]>(() => (session.kind === 'hotseat' ? [0, 1] : [viewer]), [session.kind, viewer]);
  pb.alertFor = alertFor;
  pb.names = names;
  pb.onFlush = clearLeads;
  // story 13.12: the ambient effects (runes, embers, candle) pause while actions play
  pb.onPlaying = (on) => document.documentElement.classList.toggle('cc-playing', on);
  useEffect(() => () => document.documentElement.classList.remove('cc-playing'), []);
  const view = useSyncExternalStore(pb.subscribe, pb.get);
  const shown = view.state;
  const [speed, setSpeed] = useState<AnimSpeed>(pb.speed);
  const now = useNow([snap.turnEndsAt, snap.reactionEndsAt, snap.awayUntil]);

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

  // event batch → beats (stories 7.2, 12.1); the playback's timers end with the table
  useEffect(() => () => pb.flush(), [pb]);
  pb.onCue = (cue: Cue) => {
    const { beat } = cue;
    sfx(beat.sound);
    direct(cue);
    if (beat.dice) setDice({ ...beat.dice, key: Date.now() });
    if (beat.highlight) setHighlight({ name: beat.highlight.name, cardId: beat.highlight.cardId, key: Date.now() });
  };
  // story 13.12: a batch starts playing at the next frame, so the frame of the tap (rules, React render) and the
  // frame where the staging starts (layout reads, first animations) are two shorter frames instead of one long one
  const toPush = useRef<[GameState, GameState, import('@cinecards/engine').GameEvent[]][]>([]);
  const pushFrame = useRef(0);
  useEffect(() => {
    const before = prevState.current;
    prevState.current = state;
    if (before === state || snap.seq <= 1) return;
    toPush.current.push([before, state, snap.events]);
    if (pushFrame.current) return;
    const drain = () => {
      pushFrame.current = 0;
      const q = toPush.current;
      toPush.current = [];
      for (const [b, a, e] of q) pb.push(b, a, e);
    };
    if (document.hidden || typeof requestAnimationFrame !== 'function') drain();
    else pushFrame.current = requestAnimationFrame(drain);
  }, [snap.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Playing, or about to: a new position not yet handed to the playback (it starts at the next frame). */
  const busy = pb.playing || state !== prevState.current || toPush.current.length > 0;
  useEffect(
    () => () => {
      cancelAnimationFrame(pushFrame.current);
      pushFrame.current = 0;
    },
    [],
  );
  // solo: Le Grimoire waits for the replay; hot seat: nothing plays behind the hand-over screen
  useEffect(() => session.pace?.(() => (toPush.current.length ? 1000 : pb.busyFor())), [session, pb]);
  useEffect(() => pb.pause(handoffFor !== null), [pb, handoffFor]);
  useEffect(() => {
    const hide = () => document.hidden && pb.flush();
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [pb]);
  const changeSpeed = (next: AnimSpeed) => {
    setSpeed(next);
    saveSpeed(next);
    pb.setSpeed(next);
  };
  const cycleSpeed = () => changeSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!);

  // reset interaction when the position changes; a target prompt of mine opens the picking mode (story 11.4)
  useEffect(() => {
    const p = state.pending;
    if (p?.kind === 'targets' && p.player === viewer) {
      const reqs = p.requests.map((r, index) => ({ count: r.count, min: r.min ?? r.count, options: r.options, index })).filter((r) => r.count > 0);
      const name = catalog.get(state.instances[p.source]?.cardId ?? '')?.name ?? '';
      setMode({ k: 'targets', total: p.requests.length, reqs, picked: reqs.map(() => []), label: `${triggerPhrase(p.trigger, name)} : « ${p.label} »` });
    } else setMode({ k: 'idle' });
  }, [snap.seq, viewer]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = viewer;
  const foe = other(me);
  const myTurn = state.active === me && !state.pending && state.phase === 'main';

  // story 14.2: the hand folds when the device changes hands (hot seat) and when a choice needs the table
  useEffect(() => setHandOpen(false), [viewer]);
  useEffect(() => {
    if (mode.k === 'targets') setHandOpen(false);
  }, [mode.k]);

  // story 12.5: a played card leaves the hand at once (real state); its flight starts from where it was
  useLayoutEffect(() => noteHand());

  // story 13.9: the lines stay ~3 s or until the next tap; a tap that ends them while the sheet is tucked only brings
  // the sheet back (it does not reach what lies under it)
  useEffect(() => {
    if (!lines) return;
    const swallow = lines.tuck && !wide;
    let unSwallow: (() => void) | undefined;
    const end = () => setLines((p) => (p?.key === lines.key ? null : p));
    const timer = setTimeout(end, 3000);
    const onDown = () => {
      end();
      if (!swallow) return;
      const eat = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener('click', eat, { capture: true, once: true });
      const t = setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 600);
      unSwallow = () => clearTimeout(t);
    };
    document.addEventListener('pointerdown', onDown, { capture: true });
    return () => {
      clearTimeout(timer);
      unSwallow?.();
      document.removeEventListener('pointerdown', onDown, { capture: true });
    };
  }, [lines, wide]);
  // the lines belong to the card they were asked for
  useEffect(() => {
    setLines((p) => (p && p.tuck && p.target !== inspect ? null : p));
  }, [inspect]);

  const send = (a: Action) => {
    sfx('click');
    pb.hurry();
    // story 13.12: the rules run at the next frame; the frame of the tap only closes the menus (shorter frames)
    nextFrame(() => session.send(a));
    setMode({ k: 'idle' });
    setInspect(null);
    setLines(null);
  };

  /** HP counters roll at the playback's pace (story 12.3); instantly when nothing plays. */
  const countMs = pb.playing ? Math.round(450 * pb.rate()) : 0;
  const nameOf = (iid: string) => catalog.get(state.instances[iid]?.cardId ?? '')?.name ?? '?';

  // ----- starting actions (targets and options are asked by the engine when the ability fires, story 11.4) -----
  const playFromHand = (iid: string, slot?: number, option?: number) => {
    // story 14.2: "Jouer" folds the hand, so the table is in view while the card is placed
    setHandOpen(false);
    send({ type: 'playCard', player: me, iid, ...(slot !== undefined ? { slot } : {}), ...(option !== undefined ? { option } : {}) });
  };

  const useAbility = (iid: string, ability: number, option?: number) => {
    send({ type: 'useAbility', player: me, iid, ability, ...(option !== undefined ? { option } : {}) });
  };

  // ----- target prompt: 0..N per request (story 11.5) -----
  /** One list per engine request (requests without options stay empty). */
  const groupsOf = (m: Extract<Mode, { k: 'targets' }>): string[][] => {
    const groups: string[][] = Array.from({ length: m.total }, () => []);
    m.reqs.forEach((r, k) => (groups[r.index] = m.picked[k]!));
    return groups;
  };
  const pickedAll = (m: Extract<Mode, { k: 'targets' }>) => m.picked.flat();
  const canConfirm = (m: Extract<Mode, { k: 'targets' }>) => m.reqs.every((r, k) => m.picked[k]!.length >= r.min);
  const canSkip = (m: Extract<Mode, { k: 'targets' }>) => m.reqs.every((r) => r.min === 0);
  /** The request a tap on `iid` would fill: the first one offering it that still has room. */
  const reqFor = (m: Extract<Mode, { k: 'targets' }>, iid: string) => m.reqs.findIndex((r, k) => r.options.includes(iid) && m.picked[k]!.length < r.count);

  const pickTarget = (iid: string) => {
    if (mode.k !== 'targets') return;
    const at = mode.picked.findIndex((g) => g.includes(iid));
    if (at >= 0) return setMode({ ...mode, picked: mode.picked.map((g, k) => (k === at ? g.filter((x) => x !== iid) : g)) });
    const k = reqFor(mode, iid);
    if (k >= 0) setMode({ ...mode, picked: mode.picked.map((g, j) => (j === k ? [...g, iid] : g)) });
  };
  const confirmTargets = (none = false) => {
    if (mode.k !== 'targets') return;
    send({ type: 'chooseTargets', player: me, targets: none ? Array.from({ length: mode.total }, () => []) : groupsOf(mode) });
  };

  // ----- taps -----
  const tapCard = (iid: string, stat?: 'atk' | 'hp') => {
    const inst = state.instances[iid];
    if (!inst) return;
    if (mode.k === 'targets') {
      pickTarget(iid);
      return;
    }
    if (mode.k === 'attack' && mode.targets.some((t) => t.kind === 'card' && t.iid === iid)) {
      return send({ type: 'attack', player: me, attacker: mode.iid, target: { kind: 'card', iid } });
    }
    // story 13.9: a modified badge shows the lines to that stat's sources (the card opens when there is none to draw)
    if (stat && showLines(iid, (l) => l[stat] !== 0, stat, false)) return;
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
    if (mode.k === 'targets') return !pickedAll(mode).includes(iid) && reqFor(mode, iid) >= 0;
    return false;
  };

  const cardState = (iid: string, owner: PlayerId): 'selected' | 'target' | 'ready' | 'attacker' | null => {
    if (mode.k === 'targets' && pickedAll(mode).includes(iid)) return 'selected';
    if (targetable(iid)) return 'target';
    if ((mode.k === 'attack' && mode.iid === iid) || (mode.k === 'hand' && mode.iid === iid)) return 'attacker';
    if (owner === me && myTurn && state.players[me].characters.includes(iid) && !canAttack(catalog, state, iid)) return 'ready';
    return null;
  };

  const shownStats = (iid: string) => {
    try {
      return view.stats[iid] ?? computeStats(catalog, shown, iid);
    } catch {
      return null;
    }
  };
  const renderBoardCard = (iid: string, owner: PlayerId) => {
    const inst = shown.instances[iid];
    const card = inst && catalog.get(inst.cardId);
    if (!inst || !card) return null;
    const dying = view.dying.has(iid);
    const leaving = view.returning.has(iid);
    const sick = !dying && card.category === 'character' && inst.playedOnTurn >= shown.players[owner].turnNumber && canAttack(catalog, shown, iid)?.code === 'SUMMONING_SICK';
    return (
      <CardView
        key={iid}
        iid={iid}
        card={card}
        stats={card.category === 'character' ? shownStats(iid) : null}
        statuses={view.statuses[iid] ?? inst.statuses}
        sick={!!sick}
        cycle={dying ? null : cycleCountdown(catalog, shown, iid)}
        dying={dying}
        leaving={leaving}
        state={dying || leaving ? null : cardState(iid, owner)}
        onClick={(e) => tapCard(iid, ((e.target as Element).closest('.badge.has-src') as HTMLElement | null)?.dataset.stat as 'atk' | 'hp' | undefined)}
        count={countMs}
      />
    );
  };

  const Board = ({ player }: { player: PlayerId }) => {
    const P = shown.players[player];
    const placing = player === me && playableSlots === 'characters';
    return (
      <div className={'board' + (player === me ? ' mine' : ' theirs')} aria-label={player === me ? 'Ta table' : 'Table adverse'}>
        {P.characters.map((iid, slot) => {
          return (
            <div
              key={slot}
              className={'slot' + (iid ? ' filled' : '') + (placing && !iid ? ' placeable' : '') + cited(iid)}
              onClick={(e) => {
                if (!iid) return placing ? tapSlot(player, 'characters', slot) : undefined;
                // story 13.2: the whole slot is the touch target of its (small) card
                e.stopPropagation();
                if (!(e.target as Element).closest('.card')) tapCard(iid);
              }}
              role={!iid && placing ? 'button' : undefined}
              aria-label={!iid ? `Socle ${ROMAN[slot]}` : undefined}
            >
              <span className="rune-ring" aria-hidden="true" />
              {!iid ? <span className="slot-num">{ROMAN[slot]}</span> : renderBoardCard(iid, player)}
            </div>
          );
        })}
      </div>
    );
  };

  const Zones = ({ player }: { player: PlayerId }) => {
    const P = shown.players[player];
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
          const card = catalog.get(shown.instances[iid]?.cardId ?? '');
          if (!card) return null;
          return (
            <button key={slot} type="button" data-iid={iid} className={(kind === 'terrains' ? 'seal' : 'rune') + ' filled' + (targetable(iid) ? ' is-target' : '') + cited(iid)} onClick={() => tapCard(iid)} title={card.name}>
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

  /**
   * Story 14.1: on the compact table, a "Terrains" row and a "Sorts" row of 5 slots each (mockup F, `.zrow`): a small
   * parchment plate with the category icon and the card's name, or a dashed empty slot. The foe's rows sit above its
   * characters (terrains first), mine below (spells first), so the terrains frame the table.
   */
  const ZoneRows = ({ player }: { player: PlayerId }) => {
    const P = shown.players[player];
    const row = (kind: 'terrains' | 'spells') => (
      <div key={kind} className={'zone zrow ' + kind}>
        {/* the row's name as its category mark (the words do not fit beside plates 18 to 26 px tall) */}
        <span className="zl" role="img" aria-label={kind === 'terrains' ? 'Terrains' : 'Sorts'} title={kind === 'terrains' ? 'Terrains' : 'Sorts'}>
          <i className={'zi ' + (kind === 'terrains' ? 'zi-terrain' : 'zi-spell')} />
        </span>
        <div className="zg">
          {P[kind].map((iid, slot) => {
            if (!iid) {
              const placing = player === me && playableSlots === kind;
              return (
                <span
                  key={slot}
                  className={'zempty' + (placing ? ' placeable' : '')}
                  onClick={() => tapSlot(player, kind, slot)}
                  role={placing ? 'button' : undefined}
                  aria-label={kind === 'terrains' ? 'Socle terrain' : 'Socle sort'}
                />
              );
            }
            const card = catalog.get(shown.instances[iid]?.cardId ?? '');
            if (!card) return null;
            const icon = card.category === 'terrain' ? 'zi-terrain' : card.category === 'equipment' ? 'zi-equip' : 'zi-spell';
            return (
              <button
                key={slot}
                type="button"
                data-iid={iid}
                className={'zplate' + (targetable(iid) ? ' is-target' : '') + cited(iid)}
                onClick={() => tapCard(iid)}
                aria-label={card.name}
                title={card.name}
              >
                <i className={'zi ' + icon} aria-hidden="true" />
                <span className="zn">{card.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
    return <div className="zones zrows">{player === me ? [row('spells'), row('terrains')] : [row('terrains'), row('spells')]}</div>;
  };

  const Hero = ({ player }: { player: PlayerId }) => {
    const P = shown.players[player];
    const canHit = mode.k === 'attack' && mode.targets.some((t) => t.kind === 'player' && t.player === player);
    const active = state.active === player;
    const hp = (
      <span className="hero-hp">
        <Icon name="heart" size={12} color="#FF8A8A" /> <Counter value={P.hp} ms={countMs} />
        {compact ? null : <small className="hp-max"> / {RULES.PLAYER_HP}</small>}
      </span>
    );
    const hpbar = (
      <div className="hpbar">
        <div style={{ width: `${Math.max(0, (P.hp / RULES.PLAYER_HP) * 100)}%` }} />
      </div>
    );
    return (
      <div data-hero={player} className={'hero' + (canHit ? ' is-target' : '') + (active ? ' active' : '')} onClick={() => tapHero(player)} role={canHit ? 'button' : undefined}>
        <span className="avatar">{names[player].slice(0, 1).toUpperCase()}</span>
        {compact ? (
          // story 14.1 (mockup F, `.pmain`): the name above its HP bar, then HP, coins and the piles in one line
          <>
            <div className="hero-main">
              <span className="hero-name">{names[player]}</span>
              {hpbar}
            </div>
            {hp}
          </>
        ) : (
          <div className="hero-main">
            <div className="hero-line">
              <span className="hero-name">{names[player]}</span>
              {hp}
            </div>
            {hpbar}
          </div>
        )}
        <span className="hero-coins" title={`Stock max ${P.coinCap}${P.bonusCoins ? `, dont ${P.bonusCoins} bonus` : ''}`}>
          <span className="coin small" />
          {P.coins}
          <small>/{P.coinCap}</small>
        </span>
        <span className="hero-counts">
          {/* story 14.2: on the compact table my hand count is the badge of the fan button */}
          {compact && player === me ? null : (
            <span title="Main" aria-label={`Main : ${P.hand.length}`}>
              <Icon name="hand" size={12} /> {P.hand.length}
            </span>
          )}
          <span title="Pioche" aria-label={`Pioche : ${pileCount(player)}`}>
            <Icon name="deck" size={12} /> {pileCount(player)}
          </span>
          <span title="Cimetière" aria-label={`Cimetière : ${P.graveyard.length}`}>
            <Icon name="grave" size={12} /> {P.graveyard.length}
          </span>
        </span>
        {compact && player === me ? handButton(P.hand.length) : null}
      </div>
    );
  };

  /**
   * Story 14.2 (mockup `Bouton-main.dc.html`, option 1): a gold square with three fanned cards and a red badge with
   * the number of cards in my hand; open, the fan spreads and the colours invert. 40 px, 46 px touchable.
   */
  const handButton = (n: number) => (
    <button
      type="button"
      className={'hand-btn' + (handOpen ? ' on' : '')}
      aria-expanded={handOpen}
      aria-controls="cc-hand"
      aria-label={handOpen ? 'Fermer la main' : `Ouvrir la main, ${n} carte${n > 1 ? 's' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        sfx('click');
        setHandOpen((o) => !o);
      }}
    >
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <g className="fan">
          <rect className="f1" x="10.5" y="6" width="11" height="16" rx="2" />
          <rect x="10.5" y="6" width="11" height="16" rx="2" />
          <rect className="f3" x="10.5" y="6" width="11" height="16" rx="2" />
        </g>
      </svg>
      {/* the director pops it when a drawn or returned card reaches the folded hand */}
      <span className="hand-badge">{n}</span>
    </button>
  );

  /** Story 14.1: one side of the compact table, always whole: its terrain and spell rows, then the 2 × 5 characters. */
  const Side = ({ player }: { player: PlayerId }) => {
    const mine = player === me;
    return (
      <div className={`side ${mine ? 'mine' : 'theirs'}`} data-side={player}>
        {mine ? null : ZoneRows({ player })}
        {Board({ player })}
        {mine ? ZoneRows({ player }) : null}
        {mine && handOpen ? (
          // story 14.2: the open hand, an opaque panel laid over the bottom of my side (the side does not move)
          // story 14.3: or, in the detailed view, the full cards in a panel as tall as the tallest of them
          <HandPanel detailed={detailedHand} handKey={state.players[me].hand.join(',')}>
            {handCards}
          </HandPanel>
        ) : null}
      </div>
    );
  };

  // ----- banner -----
  const secondsLeft = snap.turnEndsAt ? Math.max(0, Math.ceil((snap.turnEndsAt - now) / 1000)) : snap.turnMsLeft != null ? Math.ceil(snap.turnMsLeft / 1000) : null;
  const timerLow = secondsLeft !== null && secondsLeft <= RULES.TURN_ALERT_SECONDS;
  const banner = (() => {
    if (state.phase === 'finished') return { title: 'Fin de la partie', sub: '' };
    if (mode.k === 'targets') {
      const total = mode.reqs.reduce((s, r) => s + r.count, 0);
      const min = mode.reqs.reduce((s, r) => s + r.min, 0);
      return {
        title: mode.label,
        sub: `${pickedAll(mode).length} / ${total} ${min === total ? '' : min ? `(au moins ${min}) ` : '(jusqu’à) '}— touche une carte qui brille, puis « Valider »`,
      };
    }
    if (mode.k === 'attack') return { title: `${nameOf(mode.iid)} attaque`, sub: mode.targets.length ? 'Touche une cible' : 'Aucune cible' };
    if (mode.k === 'hand') return { title: nameOf(mode.iid), sub: 'Touche un socle libre ou « Jouer »' };
    if (state.pending && state.pending.player !== me) return { title: state.pending.kind === 'reaction' ? 'Réaction adverse…' : 'Choix adverse…', sub: `${names[foe]} réfléchit` };
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

  /**
   * Story 13.9: lines from a character's sources in play (those `pick` keeps) to the card, for ~3 s or until the next
   * tap. `stat`: colour by that stat's sign (a badge), else by the whole modifier. Returns false when nothing is drawn.
   */
  function showLines(target: string, pick: (l: ModifierLine) => boolean, stat: 'atk' | 'hp' | undefined, tuck: boolean): boolean {
    const inst = state.instances[target];
    if (!inst || !state.players[inst.owner].characters.includes(target)) return false;
    let links: SourceLink[] = [];
    try {
      links = modifierLines(catalog, state, target, computeStats(catalog, state, target).sources)
        .filter((l) => l.inPlay && !l.self && pick(l))
        .map((l) => ({ source: l.source, tone: stat ? (l[stat] > 0 ? 'buff' : 'malus') : l.tone }));
    } catch {
      return false;
    }
    if (!links.length) return false;
    setLines((p) => ({ target, links, tuck, key: (p?.key ?? 0) + 1 }));
    return true;
  }

  const sheet = inspect ? (
    <CardSheet
      key={inspect}
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
      tucked={!!lines?.tuck && !wide}
      onShowSource={(source) => showLines(inspect, (l) => l.source === source, undefined, true)}
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
      <JournalList snapLog={snap.log} alertFor={alertFor} describe={(e, s) => describeEvent(e, catalog, s, { players: names })} />
    </div>
  );

  // story 14.5 (Root): playable cards first, then the others, each group in draw order (same rule as the "ready" glow)
  const affordable = (iid: string) => {
    const inst = state.instances[iid];
    const card = inst ? catalog.get(inst.cardId) : undefined;
    return !!card && ((card.cost ?? 0) <= state.players[me].coins || state.players[me].freePlay);
  };
  const hand = sortHand(state.players[me].hand, affordable);
  const foeHand = state.players[foe].hand.length;
  const handCards = (
    <>
      {hand.map((iid, i) => {
        const inst = state.instances[iid];
        if (!inst) return null;
        const card = catalog.get(inst.cardId)!;
        const afford = affordable(iid);
        const props = {
          iid,
          card,
          cost: state.players[me].freePlay ? 0 : undefined,
          state: mode.k === 'hand' && mode.iid === iid ? 'selected' : myTurn && afford ? 'ready' : myTurn ? 'disabled' : null,
          onClick: () => tapCard(iid),
          style: { '--k': i - (hand.length - 1) / 2, ...(view.incoming.has(iid) ? { opacity: 0 } : {}) } as CSSProperties,
        } as const;
        // story 14.3: the detailed open hand shows full cards (with their ability texts)
        return detailedHand && handOpen ? <FullCard key={iid} {...props} /> : <CardView key={iid} {...props} size="hand" />;
      })}
      {hand.length === 0 ? <span className="muted">Main vide</span> : null}
    </>
  );
  const pending = state.pending;

  return (
    <div className={'table-root' + (wide ? ' wide' : '') + (compact ? ' phone' : '')}>
      <Ambient />
      {wide ? <div className="col-left">{journal}</div> : null}
      <main className={'table' + (compact ? ' compact' : '')}>
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={() => setConfirmQuit('quit')} aria-label="Quitter">
            <Icon name="flag" size={16} />
          </button>
          {snap.roomCode ? (
            // story 8.5: the "Salle" word gives way on narrow phones so the code stays on one line
            <span className="room-code" title={`Salle ${snap.roomCode}`}>
              <span className="room-label">Salle </span>
              {snap.roomCode}
            </span>
          ) : (
            <span className="room-code">CineCards</span>
          )}
          <span className="spacer" />
          {session.sendEmote ? <EmoteButton send={session.sendEmote} /> : null}
          {/* story 14.4: on the phone table of an online duel the bar has no room left; the speed moves into Réglages */}
          {speedInSettings ? null : (
            <button type="button" className="icon-btn speed-btn" onClick={cycleSpeed} aria-label={`Vitesse des animations : ${SPEED_FR[speed]}`} title={`Vitesse des animations : ${SPEED_FR[speed]}`}>
              <Icon name="speed" size={16} />
              <small>{speed === 'normal' ? '×1' : speed === 'fast' ? '×2' : '⏭'}</small>
            </button>
          )}
          <button type="button" className="icon-btn" onClick={openRules} aria-label="Règles et mots-clés">
            <Icon name="help" size={16} />
          </button>
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
          {/* story 14.4: only the folded phone hand uses this setting; desktop, tablet and landscape stay as they were */}
          {compact ? <SettingsButton speed={speedInSettings ? { value: speed, set: changeSpeed } : undefined} /> : null}
        </div>

        {Hero({ player: foe })}
        {!compact ? (
          <div className="foe-hand" aria-label={`${foeHand} cartes en main`}>
            {Array.from({ length: Math.min(foeHand, 10) }, (_, i) => (
              <CardBack key={i} small />
            ))}
          </div>
        ) : null}
        {compact ? (
          Side({ player: foe })
        ) : (
          <>
            {Zones({ player: foe })}
            {Board({ player: foe })}
          </>
        )}

        <div className={'banner parchment' + (compact && (mode.k === 'attack' || mode.k === 'targets') ? ' consigne' : '')}>
          <span className="orn" />
          <div className="banner-text">
            <strong>{banner.title}</strong>
            <span>{banner.sub}</span>
          </div>
          {secondsLeft !== null && state.phase === 'main' ? (
            <span className={'timer' + (timerLow ? ' low' : '') + (snap.turnEndsAt ? '' : ' paused')} role="timer" aria-label={`${secondsLeft} secondes restantes`}>
              <Icon name="hourglass" size={14} />
              {secondsLeft}s
            </span>
          ) : null}
          {mode.k === 'targets' ? (
            <span className="target-actions">
              {canSkip(mode) ? (
                <button type="button" className="btn small ghost" onClick={() => confirmTargets(true)}>
                  Aucune cible
                </button>
              ) : null}
              <button type="button" className="btn small primary" disabled={!canConfirm(mode)} onClick={() => confirmTargets()}>
                Valider
              </button>
            </span>
          ) : mode.k !== 'idle' ? (
            <button type="button" className="btn small ghost" onClick={() => setMode({ k: 'idle' })}>
              Annuler
            </button>
          ) : (
            <button type="button" className="btn small primary" disabled={!myTurn} onClick={() => send({ type: 'endTurn', player: me })}>
              Fin du tour
            </button>
          )}
        </div>

        {compact ? (
          Side({ player: me })
        ) : (
          <>
            {Board({ player: me })}
            {Zones({ player: me })}
          </>
        )}
        {Hero({ player: me })}
        {compact ? null : (
          <div className="hand" aria-label="Ta main">
            <div className={'hand-fan' + (hand.length > 7 ? ' many' : '')} style={{ '--n': hand.length } as CSSProperties}>
              {handCards}
            </div>
          </div>
        )}
      </main>
      {wide ? <div className="col-right">{sheet ?? <div className="inspector-empty parchment-dark">Touche une carte pour voir ses détails.</div>}</div> : sheet}
      {!wide && journalOpen ? <div className="drawer">{journal}</div> : null}
      {lines ? <SourceLines target={lines.target} links={lines.links} /> : null}

      {pending && pending.player === me && pending.kind === 'pick' ? (
        <PickModal
          key={snap.seq}
          options={pending.options}
          count={pending.count}
          min={pending.min ?? pending.count}
          label={pending.label}
          render={(iid) => catalog.get(state.instances[iid]?.cardId ?? '')}
          onDone={(picks) => send({ type: 'choose', player: me, picks })}
        />
      ) : null}
      {pending && pending.player === me && pending.kind === 'option' && handoffFor === null ? (
        <OptionModal
          title={`${triggerPhrase(pending.trigger, nameOf(pending.source))} : « ${pending.label} »`}
          labels={choiceLabels(catalog.get(state.instances[pending.source]?.cardId ?? '')?.abilities[pending.ability]?.text ?? '').slice(0, pending.choices)}
          onChoose={(option) => send({ type: 'chooseOption', player: me, option })}
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
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setHandoffFor(null);
                session.ready?.();
              }}
            >
              Je suis prêt·e
            </button>
          </div>
        </div>
      ) : null}
      {/* story 12.7: the end screen waits for the victory or defeat moment */}
      {state.phase === 'finished' && !busy ? <EndScreen state={state} me={me} names={names} kind={session.kind} onLeave={onLeave} sendEmote={session.sendEmote} /> : null}
      {session.sendEmote ? <EmoteBubbles last={snap.lastEmote} me={me} dim={mode.k === 'attack' || mode.k === 'targets'} /> : null}
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

function JournalList({
  snapLog,
  alertFor,
  describe,
}: {
  snapLog: { seq: number; event: import('@cinecards/engine').GameEvent; state: GameState }[];
  alertFor: readonly PlayerId[];
  describe: (e: import('@cinecards/engine').GameEvent, s: GameState) => string | null;
}) {
  const ref = useRef<HTMLOListElement>(null);
  // story 13.10: a card of mine removed by an opposing effect stands out in the journal
  const events = useMemo(() => snapLog.map((l) => l.event), [snapLog]);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [snapLog.length]);
  return (
    <ol className="journal-list" ref={ref}>
      {snapLog.map((l, i) => {
        const text = describe(l.event, l.state);
        if (!text) return null;
        return (
          <li key={i} className={l.event.type === 'turnStarted' ? 'turn' : l.event.type === 'gameOver' ? 'over' : alertFor.includes(removalAt(events, i)?.owner as PlayerId) ? 'removed' : ''}>
            {text}
          </li>
        );
      })}
    </ol>
  );
}

function PickModal({
  options,
  count,
  min,
  label,
  render,
  onDone,
}: {
  options: string[];
  count: number;
  min: number;
  label: string;
  render: (iid: string) => Card | undefined;
  onDone: (picks: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const need = Math.min(count, options.length);
  const floor = Math.min(min, need);
  return (
    <div className="overlay">
      <div className="parchment card-panel wide">
        <h2>{label}</h2>
        <p>
          {floor === need ? `Garde ${need}` : `Garde jusqu’à ${need}`} carte{need > 1 ? 's' : ''} ({picked.length} / {need}).
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
        <div className="row">
          {floor === 0 ? (
            <button type="button" className="btn ghost" onClick={() => onDone([])}>
              Aucune
            </button>
          ) : null}
          <button type="button" className="btn primary" disabled={picked.length < floor} onClick={() => onDone(picked)}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionModal({ title, labels, onChoose }: { title: string; labels: string[]; onChoose: (option: number) => void }) {
  return (
    <div className="overlay">
      <div className="parchment card-panel">
        <h2>{title}</h2>
        <p>Choisis un effet.</p>
        <div className="target-list">
          {labels.map((l, o) => (
            <button key={o} type="button" className="btn" onClick={() => onChoose(o)}>
              {l}
            </button>
          ))}
        </div>
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

function EndScreen({ state, me, names, kind, onLeave, sendEmote }: { state: GameState; me: PlayerId; names: [string, string]; kind: string; onLeave: () => void; sendEmote?: (id: EmoteId) => void }) {
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
        <div className="end-actions">
          <button type="button" className="btn primary" onClick={onLeave}>
            Retour à l’accueil
          </button>
          {/* story 8.5: emotes stay available on the end screen, which covers the top bar */}
          {sendEmote ? <EmoteButton send={sendEmote} className="icon-btn end-emote" /> : null}
        </div>
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
