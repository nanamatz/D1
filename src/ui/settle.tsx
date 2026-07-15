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

const BASE_STEP = 150; // ms per beat at 1× speed

/**
 * Drive the settle timeline for `events` (retriggered by `settleId`) at
 * `speed`× and publish it to descendants.
 */
export function SettleProvider({
  events,
  settleId,
  speed,
  children,
}: {
  events: readonly ScoreEvent[];
  settleId: number;
  speed: number;
  children: ReactNode;
}) {
  const [view, setView] = useState<SettleView>(IDLE);

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
        if (e.kind === 'tile') {
          chips += e.chips;
          pops[e.tileId] = e.chips;
        } else if (e.kind === 'suit') mult = e.mult;
        else if (e.kind === 'letterHand' || e.kind === 'joker' || e.kind === 'boss') {
          chips += e.chipsDelta;
          mult += e.multDelta;
        }
      }
      setView({ ...IDLE, active: true, chips, mult, tilePops: pops });
      const off = setTimeout(() => setView(IDLE), 700);
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
          if (e.kind === 'tile') {
            chips += e.chips;
            pops[e.tileId] = e.chips;
            setView({ ...base, chips, tilePops: { ...pops }, activeTileId: e.tileId });
          } else if (e.kind === 'suit') {
            mult = e.mult;
            setView({
              ...base,
              mult,
              stamp: e.suit ? { kind: 'suit', label: e.suit } : null,
            });
          } else if (e.kind === 'letterHand') {
            chips += e.chipsDelta;
            mult += e.multDelta;
            setView({ ...base, chips, mult, stamp: { kind: 'letterHand', label: e.hand } });
          } else if (e.kind === 'joker') {
            chips += e.chipsDelta;
            mult += e.multDelta;
            setView({
              ...base,
              chips,
              mult,
              activeJokerId: e.jokerId,
              jokerPop: { jokerId: e.jokerId, chips: e.chipsDelta, mult: e.multDelta },
            });
          } else if (e.kind === 'boss') {
            chips += e.chipsDelta;
            mult += e.multDelta;
            setView({ ...base, chips, mult });
          }
        }, i * step),
      );
    });

    // Hold the final tally briefly, then reset to idle 0×0 (B step 1).
    timers.push(setTimeout(() => setView(IDLE), beats.length * step + 650 / speed));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleId, speed]);

  return <SettleCtx.Provider value={view}>{children}</SettleCtx.Provider>;
}
