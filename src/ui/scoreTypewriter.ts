import { BALANCE } from '../engine/balance';
import { letterChips, wordLengthMult } from '../engine/scoring';
import type { ScoreEvent, WordSubmission } from '../engine/types';

export type ScoreTypewriterTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface ScoreTypewriterKeycap {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly tilt: number;
}

/** Authored loose mechanical banks inside the rotated chassis keywell. */
export const SCORE_TYPEWRITER_KEYCAPS: readonly ScoreTypewriterKeycap[] = [
  { id: 'a01', x: 20, y: 7, scale: 0.98, tilt: -3 },
  { id: 'a02', x: 18, y: 16.5, scale: 1.03, tilt: 2 },
  { id: 'a03', x: 17, y: 26, scale: 0.96, tilt: -1 },
  { id: 'a04', x: 19, y: 35.5, scale: 1.01, tilt: 3 },
  { id: 'a05', x: 22, y: 45, scale: 1.04, tilt: -2 },
  { id: 'a06', x: 23, y: 54.5, scale: 0.97, tilt: 1 },
  { id: 'a07', x: 21, y: 64, scale: 1.02, tilt: -3 },
  { id: 'a08', x: 18, y: 73.5, scale: 0.95, tilt: 2 },
  { id: 'a09', x: 17, y: 83, scale: 1.03, tilt: -1 },
  { id: 'a10', x: 20, y: 92.5, scale: 0.99, tilt: 3 },
  { id: 'b01', x: 48, y: 10.5, scale: 1.02, tilt: 2 },
  { id: 'b02', x: 46, y: 20.5, scale: 0.96, tilt: -3 },
  { id: 'b03', x: 47, y: 30.5, scale: 1.04, tilt: 1 },
  { id: 'b04', x: 50, y: 40.5, scale: 0.98, tilt: -2 },
  { id: 'b05', x: 51, y: 50.5, scale: 1.01, tilt: 3 },
  { id: 'b06', x: 49, y: 60.5, scale: 0.95, tilt: -1 },
  { id: 'b07', x: 46, y: 70.5, scale: 1.03, tilt: 2 },
  { id: 'b08', x: 47, y: 80.5, scale: 0.97, tilt: -3 },
  { id: 'b09', x: 50, y: 90.5, scale: 1.02, tilt: 1 },
  { id: 'c01', x: 79, y: 14, scale: 0.97, tilt: -2 },
  { id: 'c02', x: 82, y: 25, scale: 1.03, tilt: 3 },
  { id: 'c03', x: 80, y: 36, scale: 0.95, tilt: -1 },
  { id: 'c04', x: 77, y: 47, scale: 1.04, tilt: 2 },
  { id: 'c05', x: 76, y: 58, scale: 0.98, tilt: -3 },
  { id: 'c06', x: 78, y: 69, scale: 1.01, tilt: 1 },
  { id: 'c07', x: 81, y: 80, scale: 0.96, tilt: -2 },
  { id: 'c08', x: 79, y: 91, scale: 1.03, tilt: 3 },
] as const;

/** Original suit Mult from the score log, with a lexicon-derived debuff fallback. */
export function scoreTypewriterBaseSuitMult(
  events: readonly ScoreEvent[],
  fallbackBaseSuitMult: number,
): number {
  const scoredSuit = events.find((event) => event.kind === 'suit');
  if (scoredSuit?.kind === 'suit') return scoredSuit.mult;
  return fallbackBaseSuitMult;
}

/** Frozen ordinary score for this submission, before enhancements and hooks. */
export function scoreTypewriterExpectedBase(
  submission: WordSubmission,
  baseSuitMult: number,
): number {
  const suitMult = submission.isGibberish
    ? BALANCE.gibberish.mult
    : baseSuitMult;
  const scoringLength = submission.scoringLength ?? submission.tiles.length;
  const expected = letterChips(submission.tiles) * (
    suitMult + wordLengthMult(scoringLength, submission.isGibberish)
  );
  return Math.max(BALANCE.scoreTypewriter.expectedBaseFloor, expected);
}

/** Flat post-Chips×Mult score carried by the current presentation beat. */
export function scoreEventFlatDelta(event: ScoreEvent): number {
  return event.kind === 'joker' || event.kind === 'tag' ? (event.scoreDelta ?? 0) : 0;
}

/** Six deterministic tiers driven only by this event's local score magnitude. */
export function scoreTypewriterTier(
  delta: number,
  expectedBase: number,
): ScoreTypewriterTier {
  if (!Number.isFinite(delta) || !Number.isFinite(expectedBase) || delta === 0 || expectedBase <= 0) {
    return 0;
  }
  const impact = Math.abs(delta) / expectedBase;
  const [typing, fast, frenzy, overdrive] = BALANCE.scoreTypewriter.impactThresholds;
  if (impact < typing) return 1;
  if (impact < fast) return 2;
  if (impact < frenzy) return 3;
  if (impact < overdrive) return 4;
  return 5;
}

/** Local before/after axes, deliberately independent of target and round total. */
export function scoreTypewriterEventDelta(
  chipsBefore: number,
  multBefore: number,
  flatBefore: number,
  chipsAfter: number,
  multAfter: number,
  flatAfter: number,
): number {
  const before = chipsBefore * multBefore + flatBefore;
  const after = chipsAfter * multAfter + flatAfter;
  const delta = Math.abs(after - before);
  return Number.isFinite(delta) ? delta : 0;
}

/** Separate one-shot signal; it never participates in strength classification. */
export function crossedScoreTarget(previous: number, current: number, target: number): boolean {
  return Number.isFinite(previous) && Number.isFinite(current) && Number.isFinite(target) &&
    target > 0 && previous < target && current >= target;
}

export function scoreTypewriterShake(value: number, tier: ScoreTypewriterTier): number {
  if (!Number.isFinite(value)) return 0;
  const setting = Math.max(0, Math.min(100, value)) / 100;
  return setting * BALANCE.scoreTypewriter.shakeFactors[tier];
}

export function scoreTypewriterLiveTotal(
  settleComplete: boolean,
  settleActive: boolean,
  committedBefore: number,
  chips: number,
  mult: number,
  flatScore: number,
  committedScore: number,
): number {
  return !settleComplete || settleActive
    ? committedBefore + chips * mult + flatScore
    : committedScore;
}

export function scoreTypewriterBeatHash(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nextHash(state: number): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

/** Stable beat-local hash permutation; presentation only, never engine RNG. */
export function scoreTypewriterKeySequence(beatId: string, count: number): number[] {
  const keys = SCORE_TYPEWRITER_KEYCAPS.map((_, index) => index);
  let state = scoreTypewriterBeatHash(beatId) || 0x9e3779b9;
  for (let index = keys.length - 1; index > 0; index -= 1) {
    state = nextHash(state);
    const swapIndex = state % (index + 1);
    [keys[index], keys[swapIndex]] = [keys[swapIndex]!, keys[index]!];
  }
  return keys.slice(0, Math.max(0, Math.min(keys.length, Math.floor(count))));
}

/** Per-button timing; every selected key finishes inside the existing score beat. */
export function scoreTypewriterKeyTiming(
  beatId: string,
  speed: number,
  tier: ScoreTypewriterTier,
  pressIndex: number,
  pressCount: number,
): { delayMs: number; durationMs: number } {
  const safeSpeed = Math.max(1, speed);
  const beatMs = BALANCE.scoreTypewriter.beatMs / safeSpeed;
  const durationMs = Math.min(
    beatMs,
    Math.max(
      BALANCE.scoreTypewriter.keyPressFloorMs,
      BALANCE.scoreTypewriter.keyPressMs[tier] / safeSpeed,
    ),
  );
  const gapCount = Math.max(0, pressCount - 1);
  const weights = Array.from({ length: gapCount }, (_, index) => {
    const unit = scoreTypewriterBeatHash(`${beatId}:rhythm:${index}`) / 0xffffffff;
    return 1 + (unit * 2 - 1) * BALANCE.scoreTypewriter.keyRhythmJitter;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const elapsedWeight = weights
    .slice(0, Math.max(0, Math.min(pressIndex, gapCount)))
    .reduce((sum, weight) => sum + weight, 0);
  const delayMs = gapCount === 0
    ? 0
    : Math.min(beatMs - durationMs, (beatMs - durationMs) * elapsedWeight / totalWeight);
  return { delayMs, durationMs };
}
