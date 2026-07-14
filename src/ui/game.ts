/**
 * UI-side game helpers. These read engine snapshots and derive display data;
 * they contain NO game rules — every decision routes back through the engine
 * (scoreWord/judgeSentence/etc). The React hook (useGame) owns the state.
 */
import { baseScore, scoreWord } from '../engine/scoring';
import { judgeSentence } from '../engine/patterns';
import { BALANCE } from '../engine/balance';
import { isVowel } from '../engine/types';
import type { Lexicon } from '../engine/lexicon';
import type {
  BlindState,
  PatternId,
  Suit,
  Tile,
  WordSubmission,
} from '../engine/types';

export type Phase = 'playing' | 'gameover';

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
  return {
    text: base.text,
    isGibberish: base.isGibberish,
    suit: base.suit,
    chips: base.chips,
    suitMult: base.mult,
    completes: judged.match ? { pattern: judged.match.pattern, label: patternLabel(judged.match.pattern) } : null,
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

/** Letter chip value for a tile (display only). */
export const tileValue = (t: Tile): number => BALANCE.letterChips[t.letter] ?? 0;

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

/** Literal display glyph for a tile (case shown as authored: h vs H). */
export const tileGlyph = (t: Tile): string =>
  t.case === 'lower' ? t.letter.toLowerCase() : t.letter;

// ---------- Hand sorting (P1-1) ----------

export type SortMode = 'vowel' | 'value' | 'alpha';
export const SORT_MODES: readonly SortMode[] = ['vowel', 'value', 'alpha'];
export const SORT_LABEL: Record<SortMode, string> = {
  vowel: 'Vowel/Cons',
  value: 'Value',
  alpha: 'A–Z',
};

const alpha = (a: Tile, b: Tile): number => a.letter.localeCompare(b.letter);
const COMPARATORS: Record<SortMode, (a: Tile, b: Tile) => number> = {
  alpha,
  value: (a, b) => tileValue(b) - tileValue(a) || alpha(a, b), // desc, alpha tiebreak
  vowel: (a, b) => Number(isVowel(b.letter)) - Number(isVowel(a.letter)) || alpha(a, b),
};

/** Stable sort of a hand for display; input untouched. */
export function sortHand(tiles: readonly Tile[], mode: SortMode): Tile[] {
  return tiles
    .map((t, i) => ({ t, i }))
    .sort((a, b) => COMPARATORS[mode](a.t, b.t) || a.i - b.i)
    .map((x) => x.t);
}
