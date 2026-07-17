/**
 * UI-side game helpers. These read engine snapshots and derive display data;
 * they contain NO game rules — every decision routes back through the engine
 * (scoreWord/judgeSentence/etc). The React hook (useGame) owns the state.
 */
import { baseScore, scoreWord, letterString } from '../engine/scoring';
import { judgeSentence } from '../engine/patterns';
import { evaluateLetterHand, type LetterHandId } from '../engine/letterHands';
import { BALANCE } from '../engine/balance';
import { BOSS_REGISTRY } from '../engine/bosses';
import { isVowel } from '../engine/types';
import type { Lexicon } from '../engine/lexicon';
import type {
  BlindState,
  PatternId,
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
  /** the letter hand this word matches (A-2), if any */
  letterHand: { id: LetterHandId; chips: number; mult: number } | null;
  /** true if the active boss forbids this word (The Noun Lock) */
  blocked: boolean;
}

/** Preview the staged word: validity, suit, chips, and pattern completion. */
export function stagePreview(
  blind: BlindState,
  lexicon: Lexicon,
  selectedIds: readonly string[],
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
  return {
    text: base.text,
    isGibberish: base.isGibberish,
    suit: base.suit,
    chips: base.chips,
    suitMult: base.mult,
    completes: judged.match ? { pattern: judged.match.pattern, label: patternLabel(judged.match.pattern) } : null,
    letterHand: letterHand ? { id: letterHand.id, chips: letterHand.chips, mult: letterHand.mult } : null,
    blocked,
  };
}

/** POS label shown under a played word (resolved-if-known, else the tagged set). */
export function posLabel(sub: WordSubmission, lexicon: Lexicon): string {
  if (sub.isGibberish) return 'gibberish · hole';
  const entry = lexicon.lookup(sub.text);
  if (!entry || entry.pos.length === 0) return '—';
  return entry.pos.map(prettyPos).join(' / ');
}

function prettyPos(pos: string): string {
  switch (pos) {
    case 'verbTransitive':
      return 'verb · trans';
    case 'verbIntransitive':
      return 'verb · intrans';
    case 'verbLinking':
      return 'verb · linking';
    default:
      return pos;
  }
}

/** Letter chip value for a tile (display only). Stone has no letter → 0. */
export const tileValue = (t: Tile): number =>
  t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);

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
