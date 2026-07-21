/**
 * UI-side game helpers. These read engine snapshots and derive display data;
 * they contain NO game rules — every decision routes back through the engine
 * (scoreWord/judgeSentence/etc). The React hook (useGame) owns the state.
 */
import { baseScore, scoreWord, letterString } from '../engine/scoring';
import { judgeSentence, finalizeScore } from '../engine/patterns';
import { evaluateLetterHand, type LetterHandId } from '../engine/letterHands';
import { BALANCE } from '../engine/balance';
import { BOSS_REGISTRY } from '../engine/bosses';
import { isVowel } from '../engine/types';
import type { Lexicon } from '../engine/lexicon';
import type {
  BlindState,
  PatternId,
  RunState,
  Suit,
  Tile,
  WordSubmission,
} from '../engine/types';

export type Phase = 'blindselect' | 'playing' | 'cashout' | 'shop' | 'gameover';

/** A localizable toast: a locale key + interpolation params (P1-4). */
export interface MessageSpec {
  key: string;
  params?: Record<string, string | number>;
}

/** Tiles for the given ids, in id order, from a hand. */
export function tilesByIds(hand: readonly Tile[], ids: readonly string[]): Tile[] {
  const byId = new Map(hand.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is Tile => t !== undefined);
}

const PATTERN_LABEL: Record<PatternId, string> = {
  outcry: 'Outcry',
  imperative: 'Imperative',
  chant: 'Chant',
  simple: 'Simple',
  descriptive: 'Descriptive',
  transitive: 'Transitive',
  ditransitive: 'Ditransitive',
  compound: 'Compound',
};
export const patternLabel = (id: PatternId): string => PATTERN_LABEL[id];

export const SUIT_TAG: Record<Suit, string> = {
  standard: 'STD',
  formal: 'FRM',
  slang: 'SLG',
  vulgar: 'VLG',
};

/** css class suffix for a suit (word frame / tile). */
export const suitClass = (suit: Suit | null): string => (suit ? suit : 'standard');

export interface StagePreview {
  text: string;
  isGibberish: boolean;
  suit: Suit | null;
  chips: number;
  suitMult: number;
  /** the pattern this play would complete for the whole sequence, if any */
  completes: { pattern: PatternId; label: string } | null;
  /** POS of the staged word (item 6) — its tagged set, shown before submitting */
  pos: string | null;
  /** projected sentence bonus if this word is submitted (item 6): pattern + unison
   *  + modifiers on top of the raw committed. Jokers are NOT simulated here, so this
   *  is the base forecast; 0 when the play adds no sentence bonus. */
  sentenceBonus: number;
  /** the letter hand this word matches (A-2), if any */
  letterHand: { id: LetterHandId; chips: number; mult: number } | null;
  /** true if the active boss forbids this word (The Noun Lock) */
  blocked: boolean;
}

/** A translate fn (i18n `t`) — POS keys carry no params, so a key→string is enough. */
export type PosTranslate = (key: string) => string;

/** Preview the staged word: validity, suit, chips, POS, and pattern/bonus forecast. */
export function stagePreview(
  blind: BlindState,
  run: RunState,
  lexicon: Lexicon,
  selectedIds: readonly string[],
  t: PosTranslate,
): StagePreview | null {
  const tiles = tilesByIds(blind.hand, selectedIds);
  if (tiles.length === 0) return null;
  const base = baseScore(tiles, lexicon);
  const hypothetical: WordSubmission = scoreWord(tiles, lexicon);
  const judged = judgeSentence([...blind.sequence, hypothetical], lexicon);
  const blocked = blind.bossId
    ? (BOSS_REGISTRY.get(blind.bossId)?.blocks?.(base.text, lexicon) ?? false)
    : false;
  const letters = letterString(tiles);
  const letterHand = evaluateLetterHand(letters, base.isGibberish);
  // Forecast the sentence bonus this play would add: finalize the whole sequence
  // (existing words + this staged one) and subtract the raw committed. Uses the
  // joker-less settled scores (scoreWord), so it matches the engine minus sentence
  // jokers — a stable, honest preview number.
  const committedAfter = blind.committedScore + hypothetical.settledScore;
  const finalized = finalizeScore(committedAfter, judged, run.patternLevels);
  const sentenceBonus = base.isGibberish ? 0 : Math.max(0, finalized.total - committedAfter);
  return {
    text: base.text,
    isGibberish: base.isGibberish,
    suit: base.suit,
    chips: base.chips,
    suitMult: base.mult,
    completes: judged.match ? { pattern: judged.match.pattern, label: patternLabel(judged.match.pattern) } : null,
    pos: base.isGibberish ? null : posLabel(hypothetical, lexicon, t),
    sentenceBonus,
    letterHand: letterHand ? { id: letterHand.id, chips: letterHand.chips, mult: letterHand.mult } : null,
    blocked,
  };
}

/** POS label shown under a played word (resolved-if-known, else the tagged set).
 *  Localised via i18n `pos.<value>` keys (Korean/English). */
export function posLabel(sub: WordSubmission, lexicon: Lexicon, t: PosTranslate): string {
  if (sub.isGibberish) return t('pos.gibberish');
  const entry = lexicon.lookup(sub.text);
  if (!entry || entry.pos.length === 0) return '—';
  return entry.pos.map((p) => t(`pos.${p}`)).join(' / ');
}

/** Letter chip value for a tile (display only). Stone has no letter → 0. */
export const tileValue = (t: Tile): number =>
  t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);

/** First-run lesson lock: the next letter still needed to spell `word`, given the letters
 *  already staged (in order), or null once they spell it. The lock enforces order, so the
 *  staged letters are always a prefix of `word`. Case-insensitive. */
export function nextLockLetter(staged: readonly (string | null)[], word: string): string | null {
  const target = word.toUpperCase();
  return staged.length >= target.length ? null : target[staged.length]!;
}

/** Material → css class ('' for the ceramic base). */
export function materialClass(material: Tile['material']): string {
  return material === 'ceramic' ? '' : material;
}

/** Font edition → css class ('' for the medium base). */
export function fontClass(font: Tile['font']): string {
  switch (font) {
    case 'bold':
      return 'f-bold';
    case 'black':
      return 'f-black';
    case 'lightItalic':
      return 'f-light';
    case 'inline':
      return 'f-inline';
    default:
      return '';
  }
}

/** Literal display glyph for a tile (case shown as authored: h vs H).
 *  A Stone tile has no letter and renders blank — the .stone material class carries its look. */
export const tileGlyph = (t: Tile): string => {
  if (t.letter === null) return '';
  return t.case === 'lower' ? t.letter.toLowerCase() : t.letter;
};

/** Letter-ink tier by chip value (P2-3): 1 default · 2–3 · 4–5 · 8–10 gilded. */
export function inkClass(value: number): string {
  if (value >= 8) return 'ink-gild';
  if (value >= 4) return 'ink-hi';
  if (value >= 2) return 'ink-mid';
  return '';
}

/** Vowel/consonant ceramic face tint class (P2-3). Stone is neither → no tint. */
export const faceClass = (t: Tile): string => {
  if (t.letter === null) return '';
  return isVowel(t.letter) ? 'vowel' : 'cons';
};

// ---------- Hand sorting (P1-1) ----------

/** 'manual' = no sort (drag-reorder order preserved, P1-2); not a sort button. */
export type SortMode = 'vowel' | 'value' | 'alpha' | 'manual';
// 'value' (score-order) sort removed per playtest-04 item 4.
export const SORT_MODES: readonly SortMode[] = ['vowel', 'alpha'];
export const SORT_LABEL: Record<SortMode, string> = {
  vowel: 'Vowel/Cons',
  value: 'Value',
  alpha: 'A–Z',
  manual: 'Manual',
};

const alpha = (a: Tile, b: Tile): number =>
  (a.letter ?? '￿').localeCompare(b.letter ?? '￿');
const COMPARATORS: Record<Exclude<SortMode, 'manual'>, (a: Tile, b: Tile) => number> = {
  alpha,
  value: (a, b) => tileValue(b) - tileValue(a) || alpha(a, b), // desc, alpha tiebreak
  vowel: (a, b) => Number(isVowel(b.letter)) - Number(isVowel(a.letter)) || alpha(a, b),
};

/** Stable sort of a hand for display; input untouched. 'manual' preserves order. */
export function sortHand(tiles: readonly Tile[], mode: SortMode): Tile[] {
  if (mode === 'manual') return tiles.slice();
  return tiles
    .map((t, i) => ({ t, i }))
    .sort((a, b) => COMPARATORS[mode](a.t, b.t) || a.i - b.i)
    .map((x) => x.t);
}

/** Move `fromId` to `toId`'s position within an id list (drag-reorder helper). */
export function reorderIds(ids: readonly string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids.slice();
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
