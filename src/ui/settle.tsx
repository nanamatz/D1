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
import type { ChanceResult, ScoreEvent } from '../engine/types';
import { audio, type SfxName } from './audio';
import { motionOff as reducedMotion } from './motion';

/**
 * feedback: when a tile's MATERIAL / FONT / EDITION triggers during scoring, make the
 * tile itself react — the same glow + trigger wiggle used by firing Emoji Tiles.
 * Imperative by data-tile-id, so it works for a played tile (tray) AND a held tile in
 * the hand (Brass et al.) without coupling every TileView to the settle context.
 */
function triggerTile(tileId: string): void {
  if (typeof document === 'undefined') return;
  const el = document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(tileId)}"]`);
  if (!el) return;
  el.classList.remove('mat-flash', 'trig-bounce');
  void el.offsetWidth; // reflow so the animations restart if it fires again quickly
  el.classList.add('mat-flash', 'trig-bounce');
  window.setTimeout(() => el.classList.remove('mat-flash', 'trig-bounce'), 560);
}

/** Restart the board-level score impact. Amplitude comes from the Settings
 * slider's `--screen-shake` variable; reduced motion never reaches this path. */
function triggerScreenShake(): void {
  if (typeof document === 'undefined') return;
  const surfaces = document.querySelectorAll<HTMLElement>(
    '.persistent-run > .sidebar, .persistent-run > .main',
  );
  for (const surface of surfaces) {
    surface.classList.remove('settle-shake');
    void surface.offsetWidth;
    surface.classList.add('settle-shake');
    surface.addEventListener(
      'animationend',
      () => surface.classList.remove('settle-shake'),
      { once: true },
    );
  }
}

export interface SettleView {
  active: boolean;
  chips: number;
  mult: number;
  /** tile currently popping its +N tag */
  activeTileId: string | null;
  /** tileId → chip value, accumulated as each tile scores (drives the +N tags) */
  tilePops: Record<string, number>;
  /** contribution currently firing above its source letter tile. Unlike tilePops,
   *  this preserves Mult, multiplicative, gold, and zero-delta retrigger beats. */
  tileEffectPop: {
    tileId: string;
    chips: number;
    mult: number;
    gold: number;
    chipsFactor?: number | undefined;
    multFactor?: number | undefined;
    retrigger: boolean;
    chanceResults?: ChanceResult[];
    id: number;
  } | null;
  /** joker currently wiggling */
  activeJokerId: string | null;
  /** Edition enhancement beat on an Emoji Tile; its timeline slot leaves a readable gap. */
  activeJokerEnhanced: boolean;
  /** the firing joker's contribution, for its popup */
  jokerPop: {
    jokerId: string;
    id: number;
    chips: number;
    mult: number;
    chipsFactor?: number;
    multFactor?: number;
    score: number;
    gold: number;
    retrigger: boolean;
  } | null;
  /** a Word-Hand / suit / word-length stamp landing this beat */
  stamp: { kind: 'letterHand' | 'suit' | 'wordLength' | 'pouch'; label: string } | null;
  /** this beat's chip / mult increase, for the floating +N pops over the scorebox
   *  (item 6). `id` is the beat index so each pop re-mounts and replays its rise.
   * `chipsOp`/`multOp` preserve whether the source displayed +delta or ×factor. */
  scorePop: {
    chips: number;
    mult: number;
    chipsOp: 'add' | 'mul';
    multOp: 'add' | 'mul';
    id: number;
  } | null;
}

const IDLE: SettleView = {
  active: false,
  chips: 0,
  mult: 0,
  activeTileId: null,
  tilePops: {},
  tileEffectPop: null,
  activeJokerId: null,
  activeJokerEnhanced: false,
  jokerPop: null,
  stamp: null,
  scorePop: null,
};

const SettleCtx = createContext<SettleView>(IDLE);
export const useSettleView = (): SettleView => useContext(SettleCtx);

// ms per beat at 1× speed. Matches the 0.55s trigger pops so each one *finishes*
// before the next beat fires — at 150ms the pops overlapped
// three-deep and the whole tally read as one blur (playtest-06 item 1). Players
// need to see each contribution land one at a time; game speed (1/2/4×) scales it.
// Feedback 5: each contribution needs enough time to read and land before the
// next tile/effect fires. 600ms at 1× keeps the sequence readable; game speed
// still scales this single timing source to 2×/4×.
const BASE_STEP = 600;
// The visible trigger keeps the ordinary duration; the unused remainder is
// separation before the next score beat, so adjacent effects do not blur together.
const ENHANCED_JOKER_STEP = 1000;
// A Lead Plate probability badge otherwise unmounts after 150ms at 4×, before
// its delayed reveal can be read. Chance-bearing material beats keep this
// real-time floor; settle completion uses the same duration helper below.
const CHANCE_MATERIAL_STEP_MIN = 600;
const FINAL_HOLD = 650; // ms: hold the final tally before reset to idle (at 1× speed)
const REDUCED_HOLD = 700; // ms: instant-fill hold before reset (reduced motion)

const beatDurationMs = (event: ScoreEvent): number =>
  event.kind === 'edition' && event.jokerId ? ENHANCED_JOKER_STEP : BASE_STEP;

const scaledBeatDurationMs = (event: ScoreEvent, speed: number): number => {
  const scaled = beatDurationMs(event) / speed;
  return event.kind === 'material' && event.chanceResults?.length
    ? Math.max(scaled, CHANCE_MATERIAL_STEP_MIN)
    : scaled;
};

/**
 * Pure fold of one ScoreEvent into the running chips/mult tally — the single
 * accumulation rule shared by the reduced-motion and animated timelines below.
 *
 * All delta-emitting events (`letterHand`, `wordLength`, `joker`, `boss`,
 * `pouch`, `material`) ADD to mult, never overwrite. `suit` also ADDS (not
 * `mult = e.mult`): the engine's `ctx.mult` *starts at* the suit multiplier
 * (loop.ts) and every material's `multDelta` is captured as a delta around
 * that already-suit-inclusive value, so the UI's suit-starts-at-0 tally must
 * add the suit event's `mult` rather than assign it. Overwriting was
 * harmless only while `suit` was always the last mult-bearing event in the
 * log; three materials (polished/glass/leadPlate) mutate `ctx.mult` in the
 * per-tile loop that runs BEFORE `suit` is pushed, so their `material`
 * events now precede `suit` and an overwrite wipes their contribution.
 * Addition is order-independent and correct either way. Multiplicative sources
 * such as Word Hands carry their equivalent delta for this fold plus a factor
 * solely for the ×N readout.
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
  if (e.kind === 'wordLength') {
    return { chips, mult: mult + e.multDelta };
  }
  if (
    e.kind === 'letterHand' ||
    e.kind === 'joker' ||
    e.kind === 'boss' ||
    e.kind === 'pouch' ||
    e.kind === 'material' ||
    e.kind === 'font' ||
    e.kind === 'edition'
  ) {
    return { chips: chips + e.chipsDelta, mult: mult + e.multDelta };
  }
  return { chips, mult };
}

/** Emoji Tile triggers speak by the operation they actually performed. A mixed
 * chips+Mult trigger uses the heavier Mult voice so it remains legible. */
export function emojiTriggerSfx(
  event:
    | Extract<ScoreEvent, { kind: 'joker' }>
    | Extract<ScoreEvent, { kind: 'edition' }>,
): SfxName {
  const growthKind = 'growthKind' in event ? event.growthKind : undefined;
  const chipsFactor = 'chipsFactor' in event ? event.chipsFactor : undefined;
  if (growthKind === 'gold') return 'coinGain';
  if (
    event.multDelta !== 0 ||
    event.multFactor !== undefined ||
    growthKind === 'mult' ||
    growthKind === 'multAdd'
  ) return 'jokerMult';
  if (
    event.chipsDelta !== 0 ||
    chipsFactor !== undefined ||
    growthKind === 'chips'
  ) return 'jokerChips';
  return 'jokerEffect';
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
  return events
    .filter((event) => event.kind !== 'settle')
    .reduce((total, event) => total + scaledBeatDurationMs(event, speed), 0) + FINAL_HOLD / speed;
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
  screenShake,
  onComplete,
  children,
}: {
  events: readonly ScoreEvent[];
  settleId: number;
  speed: number;
  screenShake: number;
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
      audio.play('totalRoll');
      const off = setTimeout(() => {
        setView(IDLE);
        onCompleteRef.current?.();
      }, settleDurationMs(events, speed, true));
      return () => clearTimeout(off);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let chips = 0;
    let mult = 0;
    const pops: Record<string, number> = {};
    let tickStep = 0;

    let elapsed = 0;
    beats.forEach((e, i) => {
      const startsAt = elapsed;
      elapsed += scaledBeatDurationMs(e, speed);
      timers.push(
        setTimeout(() => {
          const prevChips = chips;
          const prevMult = mult;
          ({ chips, mult } = accumulate(chips, mult, e));
          // SFX (work order B): fire inside the speed-scaled beat timer so the
          // cadence tracks game speed automatically. Facade no-ops until unlocked.
          if (e.kind === 'tile') {
            audio.play('tilePop');
            audio.play('countTick', { step: tickStep++ });
            triggerTile(e.tileId);
          } else if (
            e.kind === 'suit' ||
            e.kind === 'wordLength' ||
            e.kind === 'letterHand' ||
            e.kind === 'boss' ||
            e.kind === 'pouch'
          ) {
            audio.play('stamp');
          } else if (e.kind === 'joker') {
            audio.play(emojiTriggerSfx(e));
            if (e.tileId) triggerTile(e.tileId);
          } else if (e.kind === 'font') {
            audio.play('jokerBlip');
            triggerTile(e.tileId); // feedback #3: font trigger bounces its tile
          } else if (e.kind === 'edition') {
            audio.play(e.jokerId ? emojiTriggerSfx(e) : 'jokerBlip');
            if (e.tileId) triggerTile(e.tileId); // feedback #3: edition trigger bounces the tile
          } else if (e.kind === 'material') {
            // A-2: the material's own voice when it triggers during scoring (Brass ring,
            // Stone knock, Wood knock, …), not a generic fill.
            audio.material(e.material);
            // Lead plate's Lucky roll landed a Mult hit → its dice rattle (A polish).
            if (e.material === 'leadPlate' && e.multDelta > 0) audio.play('matDiceRattle');
            // feedback #2/#3: flash + a single upward bounce on the triggering tile.
            triggerTile(e.tileId);
          }
          // Preserve the source operation in both score-box and source-object readouts.
          const chipsFactor = 'chipsFactor' in e ? e.chipsFactor : undefined;
          const multFactor = 'multFactor' in e ? e.multFactor : undefined;
          const scorePop =
            chips !== prevChips || mult !== prevMult
              ? {
                  chips: chipsFactor ?? chips - prevChips,
                  mult: multFactor ?? mult - prevMult,
                  chipsOp: chipsFactor !== undefined ? 'mul' as const : 'add' as const,
                  multOp: multFactor !== undefined ? 'mul' as const : 'add' as const,
                  id: i,
                }
              : null;
          if (scorePop && screenShake > 0) triggerScreenShake();
          const base: SettleView = {
            active: true,
            chips,
            mult,
            activeTileId: null,
            tilePops: { ...pops },
            tileEffectPop: null,
            activeJokerId: null,
            activeJokerEnhanced: false,
            jokerPop: null,
            stamp: null,
            scorePop,
          };
          if (e.kind === 'tile') {
            pops[e.tileId] = e.chips;
            setView({
              ...base,
              tilePops: { ...pops },
              activeTileId: e.tileId,
              tileEffectPop: {
                tileId: e.tileId,
                chips: e.chips,
                mult: 0,
                gold: 0,
                retrigger: false,
                id: i,
              },
            });
          } else if (e.kind === 'suit') {
            setView({ ...base, stamp: e.suit ? { kind: 'suit', label: e.suit } : null });
          } else if (e.kind === 'letterHand') {
            setView({ ...base, stamp: { kind: 'letterHand', label: e.hand } });
          } else if (e.kind === 'wordLength') {
            setView({ ...base, stamp: { kind: 'wordLength', label: String(e.letters) } });
          } else if (e.kind === 'pouch') {
            setView({ ...base, stamp: { kind: 'pouch', label: e.pouchId } });
          } else if (e.kind === 'joker') {
            // Per-tile jokers (item 3) carry a tileId — pop on that tile as well as
            // wiggling the joker, and grow the tile's +N when they add chips.
            if (e.tileId && e.chipsDelta !== 0) {
              pops[e.tileId] = (pops[e.tileId] ?? 0) + e.chipsDelta;
            }
            setView({
              ...base,
              tilePops: { ...pops },
              activeTileId: e.tileId ?? null,
              activeJokerId: e.jokerId,
              activeJokerEnhanced: false,
              jokerPop: {
                jokerId: e.jokerId,
                id: i,
                chips: e.growthKind === 'chips' ? e.growthDelta ?? 0 : e.chipsDelta,
                mult: e.growthKind === 'mult' || e.growthKind === 'multAdd'
                  ? e.growthDelta ?? 0
                  : e.multDelta,
                ...(e.growthKind === undefined && e.chipsFactor !== undefined
                  ? { chipsFactor: e.chipsFactor }
                  : {}),
                ...(e.growthKind === undefined && e.multFactor !== undefined
                  ? { multFactor: e.multFactor }
                  : {}),
                score: e.scoreDelta ?? 0,
                gold: e.growthKind === 'gold' ? e.growthDelta ?? 0 : e.goldDelta ?? 0,
                retrigger: e.retrigger ?? false,
              },
              tileEffectPop: e.tileId
                ? {
                    tileId: e.tileId,
                    chips: e.chipsDelta,
                    mult: e.multDelta,
                    ...(e.chipsFactor !== undefined ? { chipsFactor: e.chipsFactor } : {}),
                    ...(e.multFactor !== undefined ? { multFactor: e.multFactor } : {}),
                    gold: 0,
                    retrigger: e.retrigger ?? false,
                    id: i,
                  }
                : null,
            });
          } else if (e.kind === 'boss') {
            setView({ ...base });
          } else if (e.kind === 'material') {
            // Materials pop on the tile itself, not as a stamp — the tile's own
            // ceramic/glass/stone face already carries the read (GDD §2.2).
            setView({
              ...base,
              activeTileId: e.tileId,
              tileEffectPop: {
                tileId: e.tileId,
                chips: e.chipsDelta,
                mult: e.multDelta,
                ...(e.multFactor !== undefined ? { multFactor: e.multFactor } : {}),
                gold: e.goldDelta ?? 0,
                ...(e.chanceResults ? { chanceResults: e.chanceResults } : {}),
                retrigger: false,
                id: i,
              },
            });
          } else if (e.kind === 'font') {
            // Font beats land on the tile, like materials; a chipPlay delta
            // grows the tile's +N pop the way per-tile jokers do.
            if (e.chipsDelta !== 0) pops[e.tileId] = (pops[e.tileId] ?? 0) + e.chipsDelta;
            setView({
              ...base,
              tilePops: { ...pops },
              activeTileId: e.tileId,
              tileEffectPop: {
                tileId: e.tileId,
                chips: e.chipsDelta,
                mult: e.multDelta,
                gold: e.goldDelta,
                retrigger: e.effect === 'retriggerPlay',
                id: i,
              },
            });
          } else if (e.kind === 'edition') {
            if (e.tileId && e.chipsDelta !== 0) {
              pops[e.tileId] = (pops[e.tileId] ?? 0) + e.chipsDelta;
            }
            setView({
              ...base,
              tilePops: { ...pops },
              activeTileId: e.tileId ?? null,
              activeJokerId: e.jokerId ?? null,
              activeJokerEnhanced: e.jokerId !== undefined,
              jokerPop: e.jokerId
                ? {
                    jokerId: e.jokerId,
                    id: i,
                    chips: e.chipsDelta,
                    mult: e.multDelta,
                    ...(e.multFactor !== undefined ? { multFactor: e.multFactor } : {}),
                    score: 0,
                    gold: 0,
                    retrigger: false,
                  }
                : null,
              tileEffectPop: e.tileId
                ? {
                    tileId: e.tileId,
                    chips: e.chipsDelta,
                    mult: e.multDelta,
                    gold: 0,
                    multFactor: e.multFactor,
                    retrigger: false,
                    id: i,
                  }
                : null,
            });
          }
        }, startsAt),
      );
    });

    // Hold the final tally briefly, then reset to idle 0×0 (B step 1) and signal
    // completion — the round-clear UI is gated on this, not the raw score (05 A).
    timers.push(
      setTimeout(() => {
        audio.play('totalRoll');
        setView(IDLE);
        onCompleteRef.current?.();
      }, settleDurationMs(events, speed, false)),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleId, speed, screenShake]);

  return <SettleCtx.Provider value={view}>{children}</SettleCtx.Provider>;
}
