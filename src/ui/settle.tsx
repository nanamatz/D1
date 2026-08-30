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
import type {
  ChanceResult,
  ScoreEvent,
  Tile,
  TileMaterial,
  WordSubmission,
} from '../engine/types';
import { audio, type SfxName } from './audio';
import { motionOff } from './motion';
import {
  scoreEventFlatDelta,
  scoreTypewriterEventDelta,
  scoreTypewriterPeakTier,
  scoreTypewriterPrimaryKey,
  type ScoreTypewriterTier,
} from './scoreTypewriter';

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

type TileCreationEvent = Extract<ScoreEvent, { kind: 'joker' }> & {
  createdTileIds: string[];
  sourceTileId: string;
};

const hasTileCreation = (event: ScoreEvent): event is TileCreationEvent =>
  event.kind === 'joker' &&
  !!event.sourceTileId &&
  !!event.createdTileIds?.length;

const handTile = (id: string): HTMLElement | null =>
  typeof document === 'undefined'
    ? null
    : document.querySelector<HTMLElement>(`.hand [data-tile-id="${CSS.escape(id)}"]`);

function setCreatedTilesPending(events: readonly ScoreEvent[], pending: boolean): void {
  for (const event of events) {
    if (!hasTileCreation(event)) continue;
    for (const id of event.createdTileIds) {
      handTile(id)?.classList.toggle('tile-creation-pending', pending);
    }
  }
}

/** Fly a visual clone from the submitted source tile into its new hand slot. */
function animateTileCreation(event: TileCreationEvent, duration: number): () => void {
  if (typeof document === 'undefined') return () => {};
  const source = document.querySelector<HTMLElement>(
    `.submitted-tiles [data-tile-id="${CSS.escape(event.sourceTileId)}"]`,
  ) ?? document.querySelector<HTMLElement>(
    event.jokerInstanceId !== undefined
      ? `.joker-slot[data-joker-instance="${event.jokerInstanceId}"] .joker`
      : `.joker-slot[data-joker-id="${CSS.escape(event.jokerId)}"] .joker`,
  );
  const sourceRect = source?.getBoundingClientRect();
  const cleanups: Array<() => void> = [];
  let disposed = false;

  const sourceAnimation = source?.animate(
    [
      { filter: 'brightness(1)' },
      { filter: 'brightness(2.4) drop-shadow(0 0 12px #fff)' },
      { filter: 'brightness(1)' },
    ],
    { duration: Math.min(duration, 420), easing: 'steps(4, end)' },
  );
  if (sourceAnimation) {
    cleanups.push(() => sourceAnimation.cancel());
  }

  event.createdTileIds.forEach((id, index) => {
    const target = handTile(id);
    if (!target) return;
    const targetRect = target.getBoundingClientRect();
    const from = sourceRect ?? targetRect;
    const dx = from.left + from.width / 2 - (targetRect.left + targetRect.width / 2);
    const dy = from.top + from.height / 2 - (targetRect.top + targetRect.height / 2);
    const scale = targetRect.width > 0 ? from.width / targetRect.width : 1;
    const ghost = target.cloneNode(true) as HTMLElement;
    ghost.classList.remove('tile-creation-pending', 'flip-entering');
    ghost.classList.add('tile-creation-ghost');
    ghost.removeAttribute('data-flip-id');
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, {
      left: `${targetRect.left}px`,
      top: `${targetRect.top}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
    });
    document.body.appendChild(ghost);

    const delay = index * 70;
    const animation = ghost.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${scale * 0.72}) rotate(-10deg)`,
          opacity: 0,
        },
        {
          offset: 0.22,
          transform: `translate(${dx}px, ${dy}px) scale(${scale * 1.08}) rotate(8deg)`,
          opacity: 1,
        },
        {
          offset: 0.62,
          transform: `translate(${dx * 0.42}px, ${dy * 0.52 - 42}px) scale(.92) rotate(-5deg)`,
          opacity: 1,
        },
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      ],
      {
        duration: Math.max(240, duration - delay),
        delay,
        easing: 'cubic-bezier(.2, .78, .28, 1)',
        fill: 'forwards',
      },
    );
    let landed = false;
    let landingAnimation: Animation | null = null;
    const reveal = () => {
      if (landed) return;
      landed = true;
      target.classList.remove('tile-creation-pending');
      ghost.remove();
    };
    animation.addEventListener('finish', () => {
      if (disposed) return;
      reveal();
      audio.play('tileDeal');
      landingAnimation = target.animate(
        [
          { transform: 'scale(.78)', filter: 'brightness(1.8)' },
          { transform: 'scale(1.1)', filter: 'brightness(1.25)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 220, easing: 'cubic-bezier(.2, 1.5, .4, 1)' },
      );
    }, { once: true });
    animation.addEventListener('cancel', reveal, { once: true });
    cleanups.push(() => {
      animation.cancel();
      landingAnimation?.cancel();
      reveal();
    });
  });

  return () => {
    if (disposed) return;
    disposed = true;
    cleanups.forEach((cleanup) => cleanup());
  };
}

/** Restart the board-level score impact. Amplitude comes from the Settings
 * slider's `--screen-shake` variable; reduced motion never reaches this path. */
function triggerScreenShake(intensity = 1): () => void {
  if (typeof document === 'undefined') return () => {};
  const surfaces = document.querySelectorAll<HTMLElement>(
    '.persistent-run > .sidebar, .persistent-run > .main',
  );
  const cleanups: Array<() => void> = [];
  for (const surface of surfaces) {
    surface.classList.remove('settle-shake');
    surface.style.setProperty('--settle-impact', String(intensity));
    void surface.offsetWidth;
    surface.classList.add('settle-shake');
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      surface.removeEventListener('animationend', cleanup);
      surface.classList.remove('settle-shake');
      surface.style.removeProperty('--settle-impact');
    };
    surface.addEventListener('animationend', cleanup, { once: true });
    cleanups.push(cleanup);
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

export interface SettleView {
  active: boolean;
  chips: number;
  mult: number;
  /** Submission-snapshotted game speed, retained through sentence BUILD/LAND. */
  settleSpeed: number;
  /** Reduced Motion latched for this submission; OFF applies to the next one. */
  settleReduced: boolean;
  /** Running flat score applied after Chips × Mult. */
  flatScore: number;
  /** Current score-increasing beat using this settle's monotonic local-score peak tier. */
  typewriterBeat: {
    id: string;
    tier: ScoreTypewriterTier;
    delta: number;
    speed: number;
    primaryKeyId: string;
  } | null;
  /** tile currently lifting for its own score or an Emoji Tile targeting it */
  activeTileId: string | null;
  /** tileId → chip value, accumulated as each tile scores (drives the +N tags) */
  tilePops: Record<string, number>;
  /** A letter tile's own contribution firing above it. Emoji-authored values stay
   *  on the firing Emoji Tile even when its event targets this letter tile. */
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
  /** Glass tiles whose destruction beat has landed in the current timeline. */
  destroyedTileIds: readonly string[];
  /** joker currently wiggling */
  activeJokerId: string | null;
  activeJokerInstanceId: number | null;
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
    stat: number;
    retrigger: boolean;
  } | null;
  /** a Word-Hand / suit / word-length stamp landing this beat */
  stamp: { kind: 'letterHand' | 'suit' | 'wordLength' | 'pouch' | 'tag'; label: string; level?: number } | null;
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
  settleSpeed: 1,
  settleReduced: false,
  flatScore: 0,
  typewriterBeat: null,
  activeTileId: null,
  tilePops: {},
  tileEffectPop: null,
  destroyedTileIds: [],
  activeJokerId: null,
  activeJokerInstanceId: null,
  activeJokerEnhanced: false,
  jokerPop: null,
  stamp: null,
  scorePop: null,
};

const SettleCtx = createContext<SettleView>(IDLE);
export const useSettleView = (): SettleView => useContext(SettleCtx);

export interface SettlePresentationSnapshot {
  settleId: number;
  speed: number;
  reduced: boolean;
}

/** Freeze presentation settings per submission; Reduced Motion may only latch on. */
export function settlePresentationSnapshot(
  previous: SettlePresentationSnapshot,
  settleId: number,
  speed: number,
  reduced: boolean,
): SettlePresentationSnapshot {
  if (previous.settleId !== settleId) return { settleId, speed, reduced };
  if (reduced && !previous.reduced) return { ...previous, reduced: true };
  return previous;
}

// ms per beat at 1× speed; game speed (1/2×) scales this single timing source.
const BASE_STEP = 600;
// Enhanced Emoji beats keep their longer separation relative to ordinary beats.
const ENHANCED_JOKER_STEP = 1000;
// A Lead Plate probability badge would otherwise become too brief at 2×, before
// its delayed reveal can be read. Chance-bearing material beats keep this
// real-time floor; settle completion uses the same duration helper below.
const CHANCE_MATERIAL_STEP_MIN = 600;
const TILE_CREATION_STEP_MIN = 480;
const FINAL_HOLD = 650; // ms: hold the final tally before reset to idle (at 1× speed)
const REDUCED_HOLD = 700; // ms: instant-fill hold before reset (reduced motion)
const PLAY_IMPACT_DURATION_1X = 650;
const PLAY_IMPACT_DURATION_2X = 400;
const PLAY_IMPACT_CONTACT_RATIO = 0.4;
const PLAY_IMPACT_INTENSITY_BASE = 0.6;
const PLAY_IMPACT_INTENSITY_STEP = 0.07;
const PLAY_IMPACT_INTENSITY_TILE_CAP = 7;

export type PlayImpactFamily = 'paper' | 'metal' | 'brittle' | 'block';

/** Local impact silhouette for each physical material; presentation only. */
export function playImpactFamily(material: TileMaterial): PlayImpactFamily {
  switch (material) {
    case 'ceramic':
    case 'porcelain':
    case 'ivory':
      return 'paper';
    case 'polished':
    case 'leadPlate':
    case 'brass':
      return 'metal';
    case 'glass':
      return 'brittle';
    case 'stone':
    case 'wood':
      return 'block';
  }
}

/** UI-only physical-play prologue before score beat zero. */
export function playImpactDurationMs(
  tileCount: number,
  speed: number,
  reduce: boolean,
): number {
  if (reduce || tileCount <= 0) return 0;
  if (speed === 2) return PLAY_IMPACT_DURATION_2X;
  return PLAY_IMPACT_DURATION_1X;
}

/** Row-level physical weight; seven or more tiles share the capped maximum. */
export function playImpactIntensity(tileCount: number): number {
  if (tileCount <= 0) return 0;
  const count = Math.min(tileCount, PLAY_IMPACT_INTENSITY_TILE_CAP);
  return Math.min(
    1,
    PLAY_IMPACT_INTENSITY_BASE + PLAY_IMPACT_INTENSITY_STEP * (count - 1),
  );
}

const PLAY_IMPACT_CLASSES = [
  'play-impact',
  'impact-paper',
  'impact-metal',
  'impact-brittle',
  'impact-block',
] as const;

const PLAY_IMPACT_ROW_CLASSES = [
  'play-impact-group',
  'play-impact-contact',
  'play-impact-reduced',
] as const;

function submittedTile(tileId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const matches = document.querySelectorAll<HTMLElement>(
    `.submitted-tiles [data-tile-id="${CSS.escape(tileId)}"]`,
  );
  return matches.item(matches.length - 1);
}

function clearPlayImpact(el: HTMLElement): void {
  el.classList.remove(...PLAY_IMPACT_CLASSES);
  el.style.removeProperty('--play-impact-vfx-ms');
}

function clearPlayImpactRow(row: HTMLElement | null): void {
  if (!row) return;
  row.classList.remove(...PLAY_IMPACT_ROW_CLASSES);
  row.style.removeProperty('--play-impact-ms');
  row.style.removeProperty('--play-impact-vfx-ms');
  row.style.removeProperty('--play-impact-intensity');
}

const beatDurationMs = (event: ScoreEvent): number =>
  event.kind === 'edition' && event.jokerId ? ENHANCED_JOKER_STEP : BASE_STEP;

const scaledBeatDurationMs = (event: ScoreEvent, speed: number): number => {
  const scaled = beatDurationMs(event) / speed;
  if (hasTileCreation(event)) return Math.max(scaled, TILE_CREATION_STEP_MIN);
  return event.kind === 'material' && event.chanceResults?.length
    ? Math.max(scaled, CHANCE_MATERIAL_STEP_MIN)
    : scaled;
};

const tileWasDestroyed = (
  event: ScoreEvent,
): event is Extract<ScoreEvent, { kind: 'material' }> =>
  event.kind === 'material' &&
  !!event.chanceResults?.some((result) => result.outcome === 'destroyed');

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
    e.kind === 'tag' ||
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

export interface ScoreTypewriterEventFold {
  chips: number;
  mult: number;
  flatScore: number;
  tier: ScoreTypewriterTier;
  delta: number;
  primaryKeyId: string | null;
}

/** Fold final axes and retain whether any event changed the word score. */
export function foldScoreTypewriterEvents(
  events: readonly ScoreEvent[],
  target: number,
  tiles: readonly { id: string; letter: string | null }[] = [],
): ScoreTypewriterEventFold {
  let chips = 0;
  let mult = 0;
  let flatScore = 0;
  let tier: ScoreTypewriterTier = 0;
  let delta = 0;
  let primaryKeyId: string | null = null;
  for (const event of events) {
    const beforeChips = chips;
    const beforeMult = mult;
    const beforeFlatScore = flatScore;
    ({ chips, mult } = accumulate(chips, mult, event));
    flatScore += scoreEventFlatDelta(event);
    const candidateDelta = scoreTypewriterEventDelta(
      beforeChips,
      beforeMult,
      beforeFlatScore,
      chips,
      mult,
      flatScore,
    );
    if (candidateDelta > 0) {
      const beforeLocal = Math.max(0, beforeChips * beforeMult + beforeFlatScore);
      const afterLocal = Math.max(0, chips * mult + flatScore);
      tier = scoreTypewriterPeakTier(tier, beforeLocal, afterLocal, target);
      primaryKeyId = scoreTypewriterPrimaryKey(event, tiles);
      delta = candidateDelta;
    }
  }
  return { chips, mult, flatScore, tier, delta, primaryKeyId };
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
  impactTileCount = 0,
): number {
  if (reduce) return REDUCED_HOLD;
  const impact = playImpactDurationMs(impactTileCount, speed, false);
  const beats = events.filter((e) => e.kind !== 'settle').length;
  if (beats === 0) return impact;
  return impact + events
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
  submission,
  heldTiles,
  target,
  settleId,
  speed,
  screenShake,
  reducedMotion,
  onComplete,
  children,
}: {
  events: readonly ScoreEvent[];
  submission: WordSubmission | null;
  heldTiles: readonly Tile[];
  target: number;
  settleId: number;
  speed: number;
  screenShake: number;
  reducedMotion: boolean;
  onComplete?: () => void;
  children: ReactNode;
}) {
  const [view, setView] = useState<SettleView>(IDLE);
  const typewriterTileSnapshotRef = useRef<{
    settleId: number;
    tiles: readonly Pick<Tile, 'id' | 'letter'>[];
  }>({ settleId, tiles: [...(submission?.tiles ?? []), ...heldTiles] });
  if (typewriterTileSnapshotRef.current.settleId !== settleId) {
    typewriterTileSnapshotRef.current = {
      settleId,
      tiles: [...(submission?.tiles ?? []), ...heldTiles],
    };
  }
  const typewriterTiles = typewriterTileSnapshotRef.current.tiles;
  // Latest onComplete, read from the timeline effect without retriggering it.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const screenShakeRef = useRef(screenShake);
  screenShakeRef.current = screenShake;
  const activeSettleIdRef = useRef<number | null>(null);
  const impactContactSettleIdRef = useRef<number | null>(null);
  const reduce = reducedMotion || motionOff();
  const presentationSnapshotRef = useRef<SettlePresentationSnapshot>({
    settleId,
    speed,
    reduced: reduce,
  });
  presentationSnapshotRef.current = settlePresentationSnapshot(
    presentationSnapshotRef.current,
    settleId,
    speed,
    reduce,
  );
  const previousReduceRef = useRef({ settleId, reduce });
  const [reducedRestart, setReducedRestart] = useState(0);

  // Precompute the ordered beats (skip the final 'settle' bookkeeping frame).
  const beats = useMemo(() => events.filter((e) => e.kind !== 'settle'), [events]);

  // Only ON interrupts an active submission. OFF applies to the next settle so
  // the same submission is never replayed as a full-motion timeline.
  useLayoutEffect(() => {
    const previous = previousReduceRef.current;
    const turnedOn = previous.settleId === settleId && !previous.reduce && reduce;
    if (turnedOn) {
      // The word timeline may already be idle while its sentence BUILD/LAND is
      // still presenting. Keep the submission latch visible to that later beat.
      setView((current) => current.settleReduced
        ? current
        : { ...current, settleReduced: true });
      if (activeSettleIdRef.current === settleId) {
        setReducedRestart((value) => value + 1);
      }
    }
    previousReduceRef.current = { settleId, reduce };
  }, [settleId, reduce]);

  // useLayoutEffect (not useEffect) so the settle activates BEFORE paint — the
  // round number never flashes the final committed value for a frame (A-1).
  useLayoutEffect(() => {
    if (settleId === 0 || (beats.length === 0 && !submission)) {
      activeSettleIdRef.current = null;
      impactContactSettleIdRef.current = null;
      setView(IDLE);
      return;
    }
    activeSettleIdRef.current = settleId;
    const { speed: settleSpeed, reduced: settleReduced } = presentationSnapshotRef.current;
    const impactTiles = submission?.tiles.map((tile) => ({
      el: submittedTile(tile.id),
      family: playImpactFamily(tile.material),
    })) ?? [];
    const impactRow = impactTiles
      .find(({ el }) => el !== null)
      ?.el?.closest<HTMLElement>('.submitted-tiles') ?? null;

    if (settleReduced) {
      // Collapse to an instant fill, then reset to idle 0×0.
      const { chips, mult, flatScore, tier, delta, primaryKeyId } = foldScoreTypewriterEvents(
        beats,
        target,
        typewriterTiles,
      );
      const pops: Record<string, number> = {};
      const destroyedTileIds = beats
        .filter(tileWasDestroyed)
        .map((event) => event.tileId);
      for (const e of beats) {
        if (e.kind === 'tile') pops[e.tileId] = e.chips;
      }
      setView({
        ...IDLE,
        active: true,
        chips,
        mult,
        settleSpeed,
        settleReduced,
        flatScore,
        typewriterBeat: tier > 0
          ? {
              id: `${settleId}-reduced`,
              tier,
              delta,
              speed: settleSpeed,
              primaryKeyId: primaryKeyId ?? 'Enter',
            }
          : null,
        tilePops: pops,
        destroyedTileIds,
      });
      clearPlayImpactRow(impactRow);
      impactTiles.forEach(({ el }) => { if (el) clearPlayImpact(el); });
      if (impactRow && impactTiles.length > 0) impactRow.classList.add('play-impact-reduced');
      if (destroyedTileIds.length > 0) audio.play('matGlassBreak');
      audio.chips(chips);
      audio.play('totalRoll');
      const off = setTimeout(() => {
        clearPlayImpactRow(impactRow);
        activeSettleIdRef.current = null;
        setView({ ...IDLE, settleSpeed, settleReduced });
        onCompleteRef.current?.();
      }, settleDurationMs(events, settleSpeed, true, submission?.tiles.length ?? 0));
      return () => {
        clearTimeout(off);
        if (activeSettleIdRef.current === settleId) activeSettleIdRef.current = null;
        clearPlayImpactRow(impactRow);
        impactTiles.forEach(({ el }) => { if (el) clearPlayImpact(el); });
      };
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const creationCleanups: Array<() => void> = [];
    const shakeCleanups: Array<() => void> = [];
    setCreatedTilesPending(beats, true);
    setView({ ...IDLE, active: true, settleSpeed, settleReduced });
    let chips = 0;
    let mult = 0;
    let flatScore = 0;
    let typewriterTierPeak: ScoreTypewriterTier = 0;
    const pops: Record<string, number> = {};
    const destroyedTileIds = new Set<string>();
    let tickStep = 0;

    const impactDuration = playImpactDurationMs(impactTiles.length, settleSpeed, false);
    const impactIntensity = playImpactIntensity(impactTiles.length);
    const contactAt = impactDuration * PLAY_IMPACT_CONTACT_RATIO;
    const contactVfxDuration = impactDuration - contactAt;
    clearPlayImpactRow(impactRow);
    impactTiles.forEach(({ el }) => { if (el) clearPlayImpact(el); });
    if (impactRow && impactDuration > 0) {
      void impactRow.offsetWidth;
      impactRow.style.setProperty('--play-impact-ms', `${impactDuration}ms`);
      impactRow.style.setProperty('--play-impact-vfx-ms', `${contactVfxDuration}ms`);
      impactRow.style.setProperty('--play-impact-intensity', String(impactIntensity));
      impactRow.classList.add('play-impact-group');
    }
    if (impactDuration > 0) {
      timers.push(setTimeout(() => {
        impactRow?.classList.add('play-impact-contact');
        impactTiles.forEach(({ el, family }) => {
          if (!el) return;
          el.style.setProperty('--play-impact-vfx-ms', `${contactVfxDuration}ms`);
          el.classList.add('play-impact', `impact-${family}`);
        });
        if (impactContactSettleIdRef.current !== settleId) {
          impactContactSettleIdRef.current = settleId;
          audio.play('submitThock');
          if (screenShakeRef.current > 0) {
            shakeCleanups.push(triggerScreenShake(impactIntensity));
          }
        }
      }, contactAt));
      timers.push(setTimeout(() => {
        clearPlayImpactRow(impactRow);
        impactTiles.forEach(({ el }) => { if (el) clearPlayImpact(el); });
      }, impactDuration));
    }

    let elapsed = impactDuration;
    beats.forEach((e, i) => {
      const startsAt = elapsed;
      elapsed += scaledBeatDurationMs(e, settleSpeed);
      timers.push(
        setTimeout(() => {
          const prevChips = chips;
          const prevMult = mult;
          const prevFlatScore = flatScore;
          ({ chips, mult } = accumulate(chips, mult, e));
          flatScore += scoreEventFlatDelta(e);
          const typewriterDelta = scoreTypewriterEventDelta(
            prevChips,
            prevMult,
            prevFlatScore,
            chips,
            mult,
            flatScore,
          );
          const beforeLocal = Math.max(0, prevChips * prevMult + prevFlatScore);
          const afterLocal = Math.max(0, chips * mult + flatScore);
          if (typewriterDelta > 0) {
            typewriterTierPeak = scoreTypewriterPeakTier(
              typewriterTierPeak,
              beforeLocal,
              afterLocal,
              target,
            );
          }
          const typewriterTier = typewriterDelta > 0 ? typewriterTierPeak : 0;
          if (chips !== prevChips) audio.chips(chips - prevChips);
          if (tileWasDestroyed(e)) destroyedTileIds.add(e.tileId);
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
            e.kind === 'pouch' ||
            e.kind === 'tag'
          ) {
            audio.play('stamp');
          } else if (e.kind === 'joker') {
            audio.play(emojiTriggerSfx(e));
            if (hasTileCreation(e)) {
              creationCleanups.push(animateTileCreation(e, scaledBeatDurationMs(e, settleSpeed)));
            }
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
            if (tileWasDestroyed(e)) audio.play('matGlassBreak');
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
          if (scorePop && screenShakeRef.current > 0) {
            shakeCleanups.push(triggerScreenShake());
          }
          const base: SettleView = {
            active: true,
            chips,
            mult,
            settleSpeed,
            settleReduced,
            flatScore,
            typewriterBeat: typewriterTier > 0
              ? {
                  id: `${settleId}-${i}`,
                  tier: typewriterTier,
                  delta: typewriterDelta,
                  speed: settleSpeed,
                  primaryKeyId: scoreTypewriterPrimaryKey(e, typewriterTiles),
                }
              : null,
            activeTileId: null,
            tilePops: { ...pops },
            tileEffectPop: null,
            destroyedTileIds: [...destroyedTileIds],
            activeJokerId: null,
            activeJokerInstanceId: null,
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
            setView({ ...base, stamp: { kind: 'letterHand', label: e.hand, level: e.level } });
          } else if (e.kind === 'wordLength') {
            setView({ ...base, stamp: { kind: 'wordLength', label: String(e.letters) } });
          } else if (e.kind === 'pouch') {
            setView({ ...base, stamp: { kind: 'pouch', label: e.pouchId } });
          } else if (e.kind === 'tag') {
            if (e.tileId) triggerTile(e.tileId);
            setView({
              ...base,
              activeTileId: e.tileId ?? null,
              stamp: { kind: 'tag', label: e.tagId },
            });
          } else if (e.kind === 'joker') {
            // A per-tile Emoji effect carries tileId only to lift/wiggle its target.
            // Its value belongs to the firing Emoji Tile's popup, so do not repeat
            // the same Chips/Mult tag above the letter tile.
            setView({
              ...base,
              activeTileId: e.tileId ?? null,
              activeJokerId: e.jokerId,
              activeJokerInstanceId: e.jokerInstanceId ?? null,
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
                stat: e.growthKind === 'handSize' ? e.growthDelta ?? 0 : 0,
                retrigger: e.retrigger ?? false,
              },
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
              activeJokerInstanceId: e.jokerInstanceId ?? null,
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
                    stat: 0,
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
        setCreatedTilesPending(beats, false);
        audio.play('totalRoll');
        activeSettleIdRef.current = null;
        setView({ ...IDLE, settleSpeed, settleReduced });
        onCompleteRef.current?.();
      }, settleDurationMs(events, settleSpeed, false, submission?.tiles.length ?? 0)),
    );
    return () => {
      timers.forEach(clearTimeout);
      creationCleanups.forEach((cleanup) => cleanup());
      shakeCleanups.forEach((cleanup) => cleanup());
      setCreatedTilesPending(beats, false);
      if (activeSettleIdRef.current === settleId) activeSettleIdRef.current = null;
      clearPlayImpactRow(impactRow);
      impactTiles.forEach(({ el }) => { if (el) clearPlayImpact(el); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleId, reducedRestart]);

  return <SettleCtx.Provider value={view}>{children}</SettleCtx.Provider>;
}
