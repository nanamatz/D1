/**
 * Settle sequence choreography (UI_DESIGN §4, playtest-02 B). One driver replays
 * a submission's ScoreEvent[] as a timeline and shares the current beat via
 * context so every part of the board animates in sync:
 *   scorebox (chips × mult, idle 0×0) · tray tiles (+N pops) · jokers (wiggle + pop).
 *
 * Game speed scales all timing; reduced motion collapses to an instant fill.
 * Pure presentation — reads the engine's event log, drives display with timers.
 */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ScoreEvent } from '../engine/types';

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SettleView {
  active: boolean;
  chips: number;
  mult: number;
  /** tile currently popping its +N tag */
  activeTileId: string | null;
  /** tileId → chip value, accumulated as each tile scores (drives the +N tags) */
  tilePops: Record<string, number>;
  /** joker currently wiggling */
  activeJokerId: string | null;
  /** the firing joker's contribution, for its popup */
  jokerPop: { jokerId: string; chips: number; mult: number } | null;
  /** a letter-hand / suit stamp landing this beat */
  stamp: { kind: 'letterHand' | 'suit'; label: string } | null;
}

const IDLE: SettleView = {
  active: false,
  chips: 0,
  mult: 0,
  activeTileId: null,
  tilePops: {},
  activeJokerId: null,
  jokerPop: null,
  stamp: null,
};

const SettleCtx = createContext<SettleView>(IDLE);
export const useSettleView = (): SettleView => useContext(SettleCtx);

// ms per beat at 1× speed. Matches `.tile-pop.live`'s popRise (0.45s) so each
// tile's pop *finishes* before the next beat fires — at 150ms the pops overlapped
// three-deep and the whole tally read as one blur (playtest-06 item 1). Players
// need to see each contribution land one at a time; game speed (1/2/4×) scales it.
const BASE_STEP = 450;
const FINAL_HOLD = 650; // ms: hold the final tally before reset to idle (at 1× speed)
const REDUCED_HOLD = 700; // ms: instant-fill hold before reset (reduced motion)

/**
 * Pure fold of one ScoreEvent into the running chips/mult tally — the single
 * accumulation rule shared by the reduced-motion and animated timelines below.
 *
 * All delta-emitting events (`letterHand`, `joker`, `boss`, `material`) ADD to
 * mult, never overwrite. `suit` also ADDS (not `mult = e.mult`): the engine's
 * `ctx.mult` *starts at* the suit multiplier (loop.ts) and every material's
 * `multDelta` is captured as a delta around that already-suit-inclusive value,
 * so the UI's suit-starts-at-0 tally must add the suit event's `mult` rather
 * than assign it. Overwriting was harmless only while `suit` was always the
 * last mult-bearing event in the log; three materials (polished/glass/
 * leadPlate) mutate `ctx.mult` in the per-tile loop that runs BEFORE `suit` is
 * pushed, so their `material` events now precede `suit` and an overwrite wipes
 * their contribution. Addition is order-independent and correct either way.
 */
export function accumulate(
  chips: number,
  mult: number,
  e: ScoreEvent,
): { chips: number; mult: number } {
  if (e.kind === 'tile') {
    return { chips: chips + e.chips, mult };
  }
  if (e.kind === 'suit') {
    return { chips, mult: mult + e.mult };
  }
  if (
    e.kind === 'letterHand' ||
    e.kind === 'joker' ||
    e.kind === 'boss' ||
    e.kind === 'material'
  ) {
    return { chips: chips + e.chipsDelta, mult: mult + e.multDelta };
  }
  return { chips, mult };
}

/**
 * Total time (ms) the settle timeline runs for `events` at `speed`× — the single
 * source of truth for "settle complete". The round-clear / game-over UI is gated
 * on this signal, never on the raw final score (playtest-05 A; recurrence of 04
 * A-1). It scales with the number of scoring beats and with speed, so a long word
 * with many jokers is *seen* landing before the verdict fires.
 */
export function settleDurationMs(
  events: readonly ScoreEvent[],
  speed: number,
  reduce: boolean,
): number {
  if (reduce) return REDUCED_HOLD;
  const beats = events.filter((e) => e.kind !== 'settle').length;
  if (beats === 0) return 0;
  return (beats * BASE_STEP + FINAL_HOLD) / speed;
}

/**
 * Drive the settle timeline for `events` (retriggered by `settleId`) at
 * `speed`× and publish it to descendants. `onComplete` fires once when the
 * timeline lands (the completion signal that gates the round-clear UI).
 */
export function SettleProvider({
  events,
  settleId,
  speed,
  onComplete,
  children,
}: {
  events: readonly ScoreEvent[];
  settleId: number;
  speed: number;
  onComplete?: () => void;
  children: ReactNode;
}) {
  const [view, setView] = useState<SettleView>(IDLE);
  // Latest onComplete, read from the timeline effect without retriggering it.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Precompute the ordered beats (skip the final 'settle' bookkeeping frame).
  const beats = useMemo(() => events.filter((e) => e.kind !== 'settle'), [events]);

  // useLayoutEffect (not useEffect) so the settle activates BEFORE paint — the
  // round number never flashes the final committed value for a frame (A-1).
  useLayoutEffect(() => {
    if (settleId === 0 || beats.length === 0) {
      setView(IDLE);
      return;
    }
    if (reducedMotion()) {
      // Collapse to an instant fill, then reset to idle 0×0.
      let chips = 0;
      let mult = 0;
      const pops: Record<string, number> = {};
      for (const e of beats) {
        if (e.kind === 'tile') pops[e.tileId] = e.chips;
        ({ chips, mult } = accumulate(chips, mult, e));
      }
      setView({ ...IDLE, active: true, chips, mult, tilePops: pops });
      const off = setTimeout(() => {
        setView(IDLE);
        onCompleteRef.current?.();
      }, settleDurationMs(events, speed, true));
      return () => clearTimeout(off);
    }

    const step = BASE_STEP / speed;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let chips = 0;
    let mult = 0;
    const pops: Record<string, number> = {};

    beats.forEach((e, i) => {
      timers.push(
        setTimeout(() => {
          const base: SettleView = {
            active: true,
            chips,
            mult,
            activeTileId: null,
            tilePops: { ...pops },
            activeJokerId: null,
            jokerPop: null,
            stamp: null,
          };
          ({ chips, mult } = accumulate(chips, mult, e));
          if (e.kind === 'tile') {
            pops[e.tileId] = e.chips;
            setView({ ...base, chips, tilePops: { ...pops }, activeTileId: e.tileId });
          } else if (e.kind === 'suit') {
            setView({
              ...base,
              mult,
              stamp: e.suit ? { kind: 'suit', label: e.suit } : null,
            });
          } else if (e.kind === 'letterHand') {
            setView({ ...base, chips, mult, stamp: { kind: 'letterHand', label: e.hand } });
          } else if (e.kind === 'joker') {
            setView({
              ...base,
              chips,
              mult,
              activeJokerId: e.jokerId,
              jokerPop: { jokerId: e.jokerId, chips: e.chipsDelta, mult: e.multDelta },
            });
          } else if (e.kind === 'boss') {
            setView({ ...base, chips, mult });
          } else if (e.kind === 'material') {
            // Materials pop on the tile itself, not as a stamp — the tile's own
            // ceramic/glass/stone face already carries the read (GDD §2.2).
            setView({ ...base, chips, mult, activeTileId: e.tileId });
          }
        }, i * step),
      );
    });

    // Hold the final tally briefly, then reset to idle 0×0 (B step 1) and signal
    // completion — the round-clear UI is gated on this, not the raw score (05 A).
    timers.push(
      setTimeout(() => {
        setView(IDLE);
        onCompleteRef.current?.();
      }, settleDurationMs(events, speed, false)),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleId, speed]);

  return <SettleCtx.Provider value={view}>{children}</SettleCtx.Provider>;
}
