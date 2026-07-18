/**
 * Core domain types for Play the Wor!d.
 * Every table in docs/GDD.md maps onto a type here.
 * The engine layer (src/engine) must never import DOM or React types.
 */

// ---------- Tiles (GDD §2) ----------

/** Canonical letter, always stored uppercase. Case is a separate axis. */
export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

export type LetterCase = 'upper' | 'lower';

/** Enhancement layer (GDD §2.2). 'ceramic' is the unenhanced base. */
export type TileMaterial =
  | 'ceramic' | 'porcelain' | 'polished' | 'glass' | 'stone'
  | 'leadPlate' | 'ivory' | 'brass';

/** Edition layer (GDD §2.3). 'medium' (Futura Medium) is the base. */
export type TileFont = 'medium' | 'lightItalic' | 'bold' | 'inline' | 'black';

export interface Tile {
  id: string; // stable unique id — tiles are permanent, sculptable assets (GDD §2)
  /** null ⟺ material 'stone' — a letterless tile (GDD §2.2). Any word containing
   *  one fails the lexicon lookup and resolves as gibberish (§6.4). */
  letter: Letter | null;
  case: LetterCase;
  material: TileMaterial;
  font: TileFont;
}

export const VOWELS: ReadonlySet<Letter> = new Set(['A', 'E', 'I', 'O', 'U'] as Letter[]);
/** Y is a consonant under the traditional classification (GDD §2.1 note). */
export const isVowel = (l: Letter | null): boolean => l !== null && VOWELS.has(l);
/** A letterless Stone tile is NEITHER — never infer "not vowel ⇒ consonant" (GDD §2.2). */
export const isConsonant = (l: Letter | null): boolean => l !== null && !VOWELS.has(l);

// ---------- Register suits (GDD §3) ----------

export type Suit = 'standard' | 'formal' | 'slang' | 'vulgar';

// ---------- Part of speech (GDD §4.2) ----------

export type POS =
  | 'noun' // includes pronouns
  | 'verbIntransitive'
  | 'verbTransitive'
  | 'verbLinking'
  | 'adjective'
  | 'adverb'
  | 'article' // articles / determiners
  | 'conjunction'
  | 'preposition'
  | 'interjection';

export const isVerb = (p: POS): boolean =>
  p === 'verbIntransitive' || p === 'verbTransitive' || p === 'verbLinking';

/** Modifiers are "flesh, not skeleton" — absorbed by pattern matching (GDD §5.1 rule 3). */
export const isModifier = (p: POS): boolean =>
  p === 'adjective' || p === 'adverb' || p === 'article';

// ---------- Lexicon (baked table; GDD §3.2, §4.2) ----------

export interface LexiconEntry {
  /** lowercase canonical spelling */
  word: string;
  /** resolved via "adopt the strongest register" rule (GDD §3.2) */
  suit: Suit;
  /** multi-POS allowed; the slot it is played into resolves which applies (GDD §4.2) */
  pos: POS[];
}

// ---------- Word submission & the phase sequence (GDD §6) ----------

/**
 * One phase's submission. A gibberish submission (GDD §6.4, decision b-2)
 * has suit = null and posUsed = null; it is a HOLE in the sentence sequence.
 */
export interface WordSubmission {
  tiles: Tile[];
  text: string; // as spelled, original casing
  isGibberish: boolean;
  suit: Suit | null;
  /** the single POS this word occupies in the sequence; null = hole */
  posUsed: POS | null;
  /** layer-1 settled score for this word (committed immediately, GDD §7.1) */
  settledScore: number;
}

// ---------- Sentence patterns (GDD §5) ----------

export type PatternOp = 'add' | 'multiply';

export type PatternId =
  | 'outcry'
  | 'imperative'
  | 'chant'
  | 'simple'
  | 'descriptive'
  | 'transitive'
  | 'ditransitive'
  | 'compound';

export interface PatternDef {
  id: PatternId;
  /** 1 (weakest) .. 8 (strongest) — "highest single pattern only" rule (GDD §5.1 rule 2) */
  rank: number;
  op: PatternOp;
  /** current level, raised by Punctuation consumables (GDD §5.4). Starts at 1. */
  level: number;
}

export interface PatternMatch {
  pattern: PatternId;
  rank: number;
  /** modifiers absorbed by rule 3 — each adds to the bonus (GDD §5.1) */
  absorbedModifiers: number;
  /** extra data for scaling patterns, e.g. chant repeat count */
  repeats?: number;
}

/** Unison bonus — the flush substitute (GDD §5.3). Null if suits are not uniform. */
export interface UnisonResult {
  suit: Suit;
}

/** Result of judging a whole sequence (GDD §5): best pattern + unison. */
export interface SentenceJudgment {
  /** the highest-rank matching pattern, or null (no match / a gibberish hole) */
  match: PatternMatch | null;
  /** unison bonus if 2+ words share one suit, else null */
  unison: UnisonResult | null;
}

// ---------- Scoring (GDD §7) ----------

/**
 * The mutable context passed through joker hooks while one word is scored.
 * Jokers mutate chips/mult in registration order (Balatro-style left-to-right).
 */
export interface WordScoringContext {
  submission: WordSubmission;
  chips: number;
  mult: number;
}

/**
 * Ordered steps of settling one word (GDD §7.1 layer 1). The engine records
 * these per submission; the UI replays them for the settle animation
 * (UI_DESIGN §4.1). Pure data — no timing, no DOM.
 */
export type ScoreEvent =
  | { kind: 'tile'; tileId: string; letter: Letter | null; chips: number }
  | { kind: 'material'; material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }
  | { kind: 'suit'; suit: Suit | null; mult: number }
  | { kind: 'letterHand'; hand: string; chipsDelta: number; multDelta: number }
  | { kind: 'joker'; jokerId: string; chipsDelta: number; multDelta: number; tileId?: string }
  | { kind: 'boss'; bossId: string; chipsDelta: number; multDelta: number }
  | { kind: 'settle'; chips: number; mult: number; total: number };

export interface SentenceScoringContext {
  sequence: WordSubmission[];
  match: PatternMatch | null;
  unison: UnisonResult | null;
  /** running blind total before the sentence bonus is applied */
  totalBefore: number;
  /** additive patterns add here */
  flatBonus: number;
  /** multiplicative patterns multiply here */
  totalMultiplier: number;
}

// ---------- Blind / Ante / Run state (GDD §8) ----------

export type BlindKind = 'small' | 'big' | 'boss';

export interface BlindState {
  kind: BlindKind;
  bossId: string | null; // from data/bosses, only when kind === 'boss'
  target: number;
  phasesTotal: number;
  phasesUsed: number;
  discardsLeft: number;
  committedScore: number; // layer 1 accumulation
  projectedScore: number; // committed + current sentence judgment (overwrite, GDD §7.1)
  sequence: WordSubmission[];
  bag: Tile[]; // shuffled at blind start; NO refill when empty (GDD §6.6)
  hand: Tile[];
  discardedThisBlind: Tile[]; // used tiles; return to bag at blind end
  /** boss flags applied at setup (GDD §8.3) */
  earlyEndDisabled?: boolean; // The Perfectionist
  previewHidden?: boolean; // The Blindfold (UI hides the projected preview)
}

export interface RunState {
  seed: string; // seeded RNG — reproducible runs (roguelite requirement)
  ante: number; // 1..8, then endless
  blindIndex: 0 | 1 | 2; // small / big / boss
  gold: number;
  handSize: number; // base 11, a balance knob (GDD §6.2)
  basePhases: number; // base 4
  baseDiscards: number; // base 3
  bag: Tile[]; // the permanent 68-tile (sculpted) asset
  jokers: OwnedJoker[];
  consumables: ConsumableId[];
  consumableSlots: number; // base 2
  patternLevels: Record<PatternId, number>;
  vouchers: VoucherId[];
  /** the current chapter's offered voucher (fixed per chapter; playtest-03 C) */
  voucherOffer: VoucherId | null;
  /** a voucher was already bought this chapter — the slot is greyed until next chapter */
  voucherLocked: boolean;
  /** this chapter's Deadline boss, drawn at chapter start so Blind Select can
   *  always show its effect (playtest-04 D-6) */
  chapterBossId: string | null;
  /** scaling counters (GDD §11.6) — one per axis, jokers read/write these */
  counters: ScalingCounters;
}

export interface ScalingCounters {
  totalWords: number;
  formalWords: number;
  slangWords: number;
  sentencesCompleted: number;
  earlyEnds: number;
  enhancedTilesUsed: number;
  nonBaseFontTilesUsed: number;
}

// ---------- Shop (GDD §9.2) ----------

/** One purchasable in a shop item slot. `null` in a slot means bought/empty. */
export type ShopItem =
  | { kind: 'joker'; id: string; price: number }
  | { kind: 'consumable'; id: ConsumableId; price: number };

/** Pack families (GDD §9.3). */
export type PackKind = 'letter' | 'emoji' | 'consumable';

export interface ShopState {
  items: (ShopItem | null)[];
  /** single voucher slot, restocks each ante (GDD §9.2); null when owned/bought */
  voucher: VoucherId | null;
  /** pack slots (null = bought) */
  packs: (PackKind | null)[];
  /** rerolls done this visit — drives the escalating reroll cost */
  rerolls: number;
}

// ---------- Jokers (GDD §11) ----------

export type JokerRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface OwnedJoker {
  defId: string;
  /** per-instance mutable state for scaling jokers (e.g. Classicist's grown mult) */
  state: Record<string, number>;
}

// ---------- Consumables & vouchers (GDD §9–10) ----------

export type ConsumableFamily = 'stationery' | 'punctuation' | 'forbidden';

export type ConsumableId =
  // stationery
  | 'kiln' | 'fountainPen' | 'shift' | 'eraser' | 'correctionTape'
  | 'carvingKnife' | 'photocopier' | 'piggyBank' | 'magnifier'
  // punctuation (1:1 with patterns, GDD §5.4)
  | 'ellipsis' | 'exclamation' | 'doubleExclamation' | 'period'
  | 'colon' | 'semicolon' | 'dash' | 'comma'
  // forbidden books
  | 'bookBurning' | 'apocrypha' | 'scribbles' | 'apocalypse';

export type VoucherId =
  | 'extraHand' | 'extraDiscard' | 'overtime' | 'regularsDiscount'
  | 'compoundInterest' | 'thrift' | 'wideShelf' | 'connoisseur' | 'pencilCase';
