/**
 * UI-side game helpers. These read engine snapshots and derive display data;
 * they contain NO game rules — every decision routes back through the engine
 * (scoreWord/etc). The React hook (useGame) owns the state.
 */
import { letterString } from '../engine/scoring';
import { evaluateLetterHand, type LetterHandId } from '../engine/letterHands';
import { BALANCE } from '../engine/balance';
import { BOSS_REGISTRY } from '../engine/bosses';
import { isSubmissionDebuffed, prepareWordSubmission } from '../engine/loop';
import { isVowel, submissionLength } from '../engine/types';
import { fontDescKey } from './descriptions';
import type { Lexicon } from '../engine/lexicon';
import type {
  BlindState,
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

/** css class suffix for a suit (word frame / tile). */
export const suitClass = (suit: Suit | null): string => (suit ? suit : 'standard');

export interface StagePreview {
  text: string;
  isGibberish: boolean;
  suit: Suit | null;
  chips: number;
  suitMult: number;
  /** POS of the staged word (item 6) — its tagged set, shown before submitting */
  pos: string | null;
  /** the Word Hand this word matches (A-2), if any */
  letterHand: { id: LetterHandId; level: number; chips: number; mult: number } | null;
  /** true if the active boss forbids this submission */
  blocked: boolean;
  /** true if an active boss or Tag accepts this word but short-circuits scoring to 0 */
  debuffed: boolean;
}

/** A translate fn (i18n `t`) — POS keys carry no params, so a key→string is enough. */
export type PosTranslate = (key: string) => string;

/** Preview the staged word: validity, suit, chips, POS, and Word Hand. */
export function stagePreview(
  blind: BlindState,
  run: RunState,
  lexicon: Lexicon,
  selectedIds: readonly string[],
  t: PosTranslate,
): StagePreview | null {
  const tiles = tilesByIds(blind.hand, selectedIds);
  if (tiles.length === 0) return null;
  const previewRun: RunState = {
    ...run,
    jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
  };
  const { base, submission: hypothetical } =
    prepareWordSubmission(tiles, lexicon, previewRun, blind);
  const blocked = blind.bossId
    ? (BOSS_REGISTRY.get(blind.bossId)?.blocks?.(
        hypothetical,
        { run: previewRun, blind, lexicon },
      ) ?? false)
    : false;
  const debuffed = isSubmissionDebuffed(hypothetical, previewRun, blind, lexicon);
  const letters = letterString(tiles);
  const letterHand = debuffed
    ? null
    : evaluateLetterHand(
        letters,
        hypothetical.isGibberish,
        submissionLength(hypothetical),
        run.letterHandLevels,
      );
  return {
    text: hypothetical.text,
    isGibberish: hypothetical.isGibberish,
    suit: hypothetical.suit,
    chips: base.chips,
    suitMult: base.mult,
    pos: hypothetical.isGibberish || debuffed ? null : posLabel(hypothetical, lexicon, t),
    letterHand: letterHand
      ? { id: letterHand.id, level: letterHand.level, chips: letterHand.chips, mult: letterHand.mult }
      : null,
    blocked,
    debuffed,
  };
}

/** POS label shown under a played word (resolved-if-known, else the tagged set).
 *  Localised via i18n `pos.<value>` keys (Korean/English). */
export function posLabel(sub: WordSubmission, lexicon: Lexicon, t: PosTranslate): string {
  if (sub.isGibberish) return t('pos.gibberish');
  const entry = lexicon.lookup(sub.text);
  if (!entry || entry.pos.length === 0) return t('pos.unknown');
  return entry.pos.map((p) => t(`pos.${p}`)).join(' / ');
}

/** Letter chip value for a tile (display only). Stone has no letter → 0. */
export const tileValue = (t: Tile): number =>
  t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);

/** Tooltip total: Stone's material chips replace its missing letter value. */
export const tileTooltipChips = (t: Tile): number =>
  t.material === 'stone' ? BALANCE.materials.stone.chips : tileValue(t);

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

export type TileEnhancementAxis = 'material' | 'font' | 'edition';

/** Presentation-only diff for the three independent tile enhancement axes. */
export function changedTileAxes(
  previous: Pick<Tile, 'material' | 'font' | 'edition'>,
  next: Pick<Tile, 'material' | 'font' | 'edition'>,
): TileEnhancementAxis[] {
  const changed: TileEnhancementAxis[] = [];
  if (previous.material !== next.material) changed.push('material');
  if (previous.font !== next.font) changed.push('font');
  if ((previous.edition ?? 'base') !== (next.edition ?? 'base')) changed.push('edition');
  return changed;
}

/** A translate fn that also takes interpolation params (tile chips line needs one). */
type TFull = (key: string, params?: Record<string, string | number>) => string;

/**
 * The shared letter-tile tooltip (feature-04 B, GDD §2.4). Spells out the three
 * enhancement axes SEPARATELY: compact badges stack beneath the main tooltip and
 * their effect definitions use the shared count-aware inline/left layout.
 */
export function tileTooltip(tile: Tile, t: TFull) {
  const tags: { label: string; tone: 'material' | 'font' | 'gray' | 'violet' | 'rainbow' }[] = [];
  const sub: { title: string; body: string; kind: 'material' | 'font' | 'edition' }[] = [];
  if (tile.material !== 'ceramic') {
    const title = t(`material.${tile.material}`);
    tags.push({ label: title, tone: 'material' });
    sub.push({ title, body: t(`materialdesc.${tile.material}`), kind: 'material' });
  }
  if (tile.font !== 'medium') {
    // fonteffectdesc is keyed by EFFECT, resolved through the balance mapping.
    const title = t(`font.${tile.font}`);
    tags.push({ label: title, tone: 'font' });
    sub.push({ title, body: t(fontDescKey(tile.font)), kind: 'font' });
  }
  const edition = tile.edition ?? 'base';
  if (edition !== 'base') {
    const title = t(`edition.${edition}`);
    tags.push({ label: title, tone: edition });
    sub.push({ title, body: t(`editiondesc.${edition}`), kind: 'edition' });
  }
  // Stone has no glyph — title falls back to its material name so the card is identifiable.
  const title = tileGlyph(tile) || t(`material.${tile.material}`);
  return { title, body: t('tile.chips', { n: tileTooltipChips(tile) }), tags, sub };
}

/** Wood alone shows its live +Chips growth; other materials rely on texture and tooltip. */
export function materialGlyph(tile: Tile): string | null {
  return tile.material === 'wood'
    ? `+${tile.woodBonusChips ?? BALANCE.materials.wood.baseChips}`
    : null;
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

/** Uppercase display glyph. A Stone tile is blank; its material carries the look. */
export const tileGlyph = (t: Tile): string => t.letter ?? '';

/** Exact letter-ink class by base chip value. Stone (0) stays unclassified. */
export function inkClass(value: number): string {
  return value > 0 ? `ink-${value}` : '';
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

/** Move `fromId` immediately before `beforeId`; null appends it. */
export function reorderIds(
  ids: readonly string[],
  fromId: string,
  beforeId: string | null,
): string[] {
  const from = ids.indexOf(fromId);
  if (from < 0 || fromId === beforeId) return ids.slice();
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  const to = beforeId === null ? next.length : next.indexOf(beforeId);
  if (to < 0) return ids.slice();
  next.splice(to, 0, moved!);
  return next;
}
