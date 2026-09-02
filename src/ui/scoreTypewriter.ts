import { BALANCE } from '../engine/balance';
import type { ScoreEvent } from '../engine/types';

export type ScoreTypewriterTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type KeyboardKeyRole = 'main' | 'function' | 'nav' | 'numpad';

export interface KeyboardKeyDef {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly role: KeyboardKeyRole;
}

interface KeySpec {
  readonly id: string;
  readonly label: string;
  readonly units?: number;
  readonly extraAfter?: number;
}

const KEYBOARD_SOURCE_WIDTH = 1774;
const KEYBOARD_SOURCE_HEIGHT = 887;
const KEY_HEIGHT = 47;
const ROW_GAP = 7;
const MAIN_UNIT = 64;
const MAIN_X = 94;
const MAIN_WIDTH = 1044;
const ROW_Y = [302, 361, 420, 479, 538, 597] as const;

function keyDef(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  role: KeyboardKeyRole,
): KeyboardKeyDef {
  return {
    id,
    label,
    x: x / KEYBOARD_SOURCE_WIDTH * 100,
    y: y / KEYBOARD_SOURCE_HEIGHT * 100,
    w: width / KEYBOARD_SOURCE_WIDTH * 100,
    h: height / KEYBOARD_SOURCE_HEIGHT * 100,
    role,
  };
}

function keyRow(
  specs: readonly KeySpec[],
  x: number,
  y: number,
  width: number,
  role: KeyboardKeyRole,
  fixedUnit?: number,
): KeyboardKeyDef[] {
  const gaps = specs.slice(0, -1).reduce((sum, spec) => sum + ROW_GAP + (spec.extraAfter ?? 0), 0);
  const units = specs.reduce((sum, spec) => sum + (spec.units ?? 1), 0);
  const unit = fixedUnit ?? (width - gaps) / units;
  let cursor = x;
  return specs.map((spec, index) => {
    const keyWidth = unit * (spec.units ?? 1);
    const key = keyDef(spec.id, spec.label, cursor, y, keyWidth, KEY_HEIGHT, role);
    cursor += keyWidth + (index < specs.length - 1 ? ROW_GAP + (spec.extraAfter ?? 0) : 0);
    return key;
  });
}

const functionKeys = keyRow([
  { id: 'Escape', label: 'ESC', extraAfter: 22 },
  ...Array.from({ length: 12 }, (_, index): KeySpec => ({
    id: `F${index + 1}`,
    label: `F${index + 1}`,
    extraAfter: index === 3 || index === 7 ? 22 : 0,
  })),
], MAIN_X, ROW_Y[0], MAIN_WIDTH, 'function', 47);

const mainRows = [
  keyRow([
    { id: 'Backquote', label: '`' },
    ...Array.from({ length: 10 }, (_, index): KeySpec => ({ id: `Digit${index}`, label: String(index) }))
      .slice(1)
      .concat({ id: 'Digit0', label: '0' }),
    { id: 'Minus', label: '-' },
    { id: 'Equal', label: '=' },
    { id: 'Backspace', label: 'BACKSPACE', units: 2 },
  ], MAIN_X, ROW_Y[1], MAIN_WIDTH, 'main'),
  keyRow([
    { id: 'Tab', label: 'TAB', units: 1.5 },
    ...'QWERTYUIOP'.split('').map((letter): KeySpec => ({ id: `Key${letter}`, label: letter })),
    { id: 'BracketLeft', label: '[' },
    { id: 'BracketRight', label: ']' },
    { id: 'Backslash', label: '\\', units: 1.5 },
  ], MAIN_X, ROW_Y[2], MAIN_WIDTH, 'main'),
  keyRow([
    { id: 'CapsLock', label: 'CAPS', units: 1.75 },
    ...'ASDFGHJKL'.split('').map((letter): KeySpec => ({ id: `Key${letter}`, label: letter })),
    { id: 'Semicolon', label: ';' },
    { id: 'Quote', label: "'" },
    { id: 'Enter', label: 'ENTER', units: 2.25 },
  ], MAIN_X, ROW_Y[3], MAIN_WIDTH, 'main'),
  keyRow([
    { id: 'ShiftLeft', label: 'SHIFT', units: 2.25 },
    ...'ZXCVBNM'.split('').map((letter): KeySpec => ({ id: `Key${letter}`, label: letter })),
    { id: 'Comma', label: ',' },
    { id: 'Period', label: '.' },
    { id: 'Slash', label: '/' },
    { id: 'ShiftRight', label: 'SHIFT', units: 2.75 },
  ], MAIN_X, ROW_Y[4], MAIN_WIDTH, 'main'),
  keyRow([
    { id: 'ControlLeft', label: 'CTRL', units: 1.25 },
    { id: 'AltLeft', label: 'ALT', units: 1.25 },
    { id: 'Space', label: 'SPACE', units: 7 },
    { id: 'AltRight', label: 'ALT', units: 1.25 },
    { id: 'ControlRight', label: 'CTRL', units: 1.25 },
  ], MAIN_X + (MAIN_WIDTH - (12 * MAIN_UNIT + 4 * ROW_GAP)) / 2, ROW_Y[5], MAIN_WIDTH, 'main', MAIN_UNIT),
].flat();

function gridKey(
  id: string,
  label: string,
  column: number,
  row: number,
  role: 'nav' | 'numpad',
  columns: number,
  x: number,
  width: number,
  columnSpan = 1,
  rowSpan = 1,
): KeyboardKeyDef {
  const gap = 7;
  const keyWidth = (width - gap * (columns - 1)) / columns;
  return keyDef(
    id,
    label,
    x + column * (keyWidth + gap),
    ROW_Y[row] ?? ROW_Y[0],
    keyWidth * columnSpan + gap * (columnSpan - 1),
    KEY_HEIGHT * rowSpan + 12 * (rowSpan - 1),
    role,
  );
}

const NAV_X = 1177;
const NAV_WIDTH = 192;
const navKeys: KeyboardKeyDef[] = [
  ['PrintScreen', 'PRINT', 0, 0], ['ScrollLock', 'SCROLL', 1, 0], ['Break', 'BREAK', 2, 0],
  ['Insert', 'INS', 0, 1], ['Home', 'HOME', 1, 1], ['PageUp', 'PGUP', 2, 1],
  ['Delete', 'DEL', 0, 2], ['End', 'END', 1, 2], ['PageDown', 'PGDN', 2, 2],
  ['ArrowUp', '↑', 1, 4], ['ArrowLeft', '←', 0, 5], ['ArrowDown', '↓', 1, 5], ['ArrowRight', '→', 2, 5],
].map(([id, label, column, row]) => gridKey(
  String(id), String(label), Number(column), Number(row), 'nav', 3, NAV_X, NAV_WIDTH,
));

const NUMPAD_X = 1404;
const NUMPAD_WIDTH = 258;
const numpadKeys: KeyboardKeyDef[] = [
  gridKey('NumLock', 'NUM', 0, 1, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH),
  gridKey('NumpadDivide', '/', 1, 1, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH),
  gridKey('NumpadMultiply', '*', 2, 1, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH),
  gridKey('NumpadSubtract', '-', 3, 1, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH),
  ...['7', '8', '9'].map((label, column) => gridKey(`Numpad${label}`, label, column, 2, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH)),
  gridKey('NumpadAdd', '+', 3, 2, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH, 1, 2),
  ...['4', '5', '6'].map((label, column) => gridKey(`Numpad${label}`, label, column, 3, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH)),
  ...['1', '2', '3'].map((label, column) => gridKey(`Numpad${label}`, label, column, 4, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH)),
  gridKey('NumpadEnter', 'ENTER', 3, 4, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH, 1, 2),
  gridKey('Numpad0', '0', 0, 5, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH, 2),
  gridKey('NumpadDecimal', '.', 2, 5, 'numpad', 4, NUMPAD_X, NUMPAD_WIDTH),
];

/** UI-only ANSI-derived registry; every cap is a deterministic score-feedback candidate. */
export const SCORE_TYPEWRITER_KEYCAPS: readonly KeyboardKeyDef[] = [
  ...functionKeys,
  ...mainRows,
  ...navKeys,
  ...numpadKeys,
];

export const SCORE_TYPEWRITER_SAMPLE_COUNT = 32;
const SCORE_TYPEWRITER_ENTER_INDEX = SCORE_TYPEWRITER_KEYCAPS.findIndex(({ id }) => id === 'Enter');

/** Stable physical-key voice; unknown ids use the main Enter key's sample. */
export function scoreTypewriterSampleIndex(keyId: string): number {
  const keyIndex = SCORE_TYPEWRITER_KEYCAPS.findIndex(({ id }) => id === keyId);
  return (keyIndex >= 0 ? keyIndex : SCORE_TYPEWRITER_ENTER_INDEX) % SCORE_TYPEWRITER_SAMPLE_COUNT;
}

const playedLetter = (
  tileId: string | undefined,
  tiles: readonly { id: string; letter: string | null }[],
): string | null | undefined => tiles.find((tile) => tile.id === tileId)?.letter;

const letterKey = (letter: string | null | undefined): string =>
  letter === null ? 'Space' : /^[A-Z]$/.test(letter ?? '') ? `Key${letter}` : 'Enter';

/** Pick the key that semantically owns this presentation beat. */
export function scoreTypewriterPrimaryKey(
  event: ScoreEvent,
  tiles: readonly { id: string; letter: string | null }[] = [],
): string {
  if (event.kind === 'tile') return letterKey(event.letter);
  if (event.kind === 'tag') {
    if (event.tileId) return letterKey(playedLetter(event.tileId, tiles));
    return 'Tab';
  }
  if (event.kind === 'pouch') return 'Space';
  if (event.kind === 'boss') return 'Break';
  if (event.kind === 'joker') {
    if (event.tileId) return letterKey(playedLetter(event.tileId, tiles));
    return `F${scoreTypewriterBeatHash(event.jokerId) % 12 + 1}`;
  }
  if (event.kind === 'material' || event.kind === 'font') {
    return letterKey(playedLetter(event.tileId, tiles));
  }
  if (event.kind === 'edition') {
    if (event.tileId) return letterKey(playedLetter(event.tileId, tiles));
    if (event.jokerId) return `F${scoreTypewriterBeatHash(event.jokerId) % 12 + 1}`;
  }
  return 'Enter';
}

/** Flat post-Chips×Mult score carried by the current presentation beat. */
export function scoreEventFlatDelta(event: ScoreEvent): number {
  return event.kind === 'joker' || event.kind === 'tag' ? (event.scoreDelta ?? 0) : 0;
}

/** Classify a positive sentence-assisted submission score against the blind target. */
export function scoreTypewriterTier(
  settledScore: number,
  target: number,
): ScoreTypewriterTier {
  if (!Number.isFinite(settledScore) || !Number.isFinite(target) || target <= 0 || settledScore <= 0) {
    return 0;
  }
  const ratio = settledScore / target;
  const [tier1, tier2, tier3, tier4, tier5, tier6] = BALANCE.scoreTypewriter.ratioThresholds;
  if (ratio < tier1) return 0;
  if (ratio < tier2) return 1;
  if (ratio < tier3) return 2;
  if (ratio < tier4) return 3;
  if (ratio < tier5) return 4;
  if (ratio < tier6) return 5;
  return 6;
}

/** Raise, but never lower, the tier after a local increase; assist alone cannot activate it. */
export function scoreTypewriterPeakTier(
  previous: ScoreTypewriterTier,
  beforeLocal: number,
  afterLocal: number,
  target: number,
  sentenceAssist = 0,
): ScoreTypewriterTier {
  if (
    !Number.isFinite(beforeLocal)
    || !Number.isFinite(afterLocal)
    || !Number.isFinite(sentenceAssist)
    || afterLocal <= beforeLocal
  ) {
    return previous;
  }
  return Math.max(
    previous,
    scoreTypewriterTier(Math.max(0, afterLocal) + Math.max(0, sentenceAssist), target),
  ) as ScoreTypewriterTier;
}

/** UI-only clear lifecycle: keep the submission peak until resolution leaves play. */
export function scoreTypewriterClearPeak(
  previous: ScoreTypewriterTier,
  resolutionActive: boolean,
  active: boolean,
  tier: ScoreTypewriterTier,
): ScoreTypewriterTier {
  if (!resolutionActive) return 0;
  return active
    ? Math.max(previous, tier) as ScoreTypewriterTier
    : previous;
}

/** Local before/after axes used only to decide whether a beat changes score. */
export function scoreTypewriterEventDelta(
  chipsBefore: number,
  multBefore: number,
  flatBefore: number,
  chipsAfter: number,
  multAfter: number,
  flatAfter: number,
): number {
  const before = Math.max(0, chipsBefore * multBefore + flatBefore);
  const after = Math.max(0, chipsAfter * multAfter + flatAfter);
  const delta = after - before;
  return Number.isFinite(delta) && delta > 0 ? delta : 0;
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

/** Clear-celebration cadence reuses the score beat and its clearing-submission speed snapshot. */
export function scoreTypewriterClearRepeatMs(tier: ScoreTypewriterTier, speed: number): number {
  const safeSpeed = Math.max(1, Number.isFinite(speed) ? speed : 1);
  return BALANCE.scoreTypewriter.beatMs * BALANCE.scoreTypewriter.clearRepeatFactors[tier] / safeSpeed;
}

/** Immediate, self-scheduling presentation loop; cleanup stops every future cycle. */
export function scheduleScoreTypewriterClearRepeats(
  intervalMs: number,
  onCycle: (cycle: number) => void,
): () => void {
  let live = true;
  let cycle = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (): void => {
    if (!live) return;
    onCycle(cycle);
    cycle += 1;
    timer = setTimeout(run, intervalMs);
  };
  run();
  return () => {
    live = false;
    if (timer !== undefined) clearTimeout(timer);
  };
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
export function scoreTypewriterKeySequence(
  beatId: string,
  count: number,
  primaryKeyId?: string,
): number[] {
  const keys = SCORE_TYPEWRITER_KEYCAPS.map((_, index) => index);
  let state = scoreTypewriterBeatHash(beatId) || 0x9e3779b9;
  for (let index = keys.length - 1; index > 0; index -= 1) {
    state = nextHash(state);
    const swapIndex = state % (index + 1);
    [keys[index], keys[swapIndex]] = [keys[swapIndex]!, keys[index]!];
  }
  const take = Math.max(0, Math.min(keys.length, Math.floor(count)));
  const primaryIndex = primaryKeyId === undefined
    ? -1
    : SCORE_TYPEWRITER_KEYCAPS.findIndex(({ id }) => id === primaryKeyId);
  if (take === 0 || primaryIndex < 0) return keys.slice(0, take);
  return [primaryIndex, ...keys.filter((index) => index !== primaryIndex).slice(0, take - 1)];
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
