/**
 * Core domain types for Play the Wor!d.
 * Every table in docs/GDD.md maps onto a type here.
 * The engine layer (src/engine) must never import DOM or React types.
 */

// ---------- Tiles (GDD §2) ----------

/** Canonical letter, always stored and displayed uppercase. */
export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

/** Enhancement layer (GDD §2.2). 'ceramic' is the unenhanced base. */
export type TileMaterial =
  | 'ceramic' | 'porcelain' | 'polished' | 'glass' | 'stone'
  | 'leadPlate' | 'ivory' | 'brass' | 'wood';

/** Font enhancement axis (GDD §2.3). `bold` is the persisted id displayed as Void. */
export type TileFont = 'medium' | 'lightItalic' | 'bold' | 'inline' | 'black';

/** Balatro-style visual/scoring edition, separate from material and font. */
export type TileEdition = 'base' | 'gray' | 'violet' | 'rainbow';

/** Font seal effects (GDD §2.3) — the edition layer's Balatro-seal port. */
export type FontEffectId = 'goldPlay' | 'chipPlay' | 'retriggerPlay' | 'discardGain';

export interface Tile {
  id: string; // stable unique id — tiles are permanent, sculptable assets (GDD §2)
  /** null ⟺ material 'stone' — a letterless tile (GDD §2.2). Any word containing
   *  one fails the lexicon lookup and resolves as gibberish (§6.4). */
  letter: Letter | null;
  material: TileMaterial;
  font: TileFont;
  /** Missing only on legacy saves/test fixtures; engine treats it as `base`. */
  edition?: TileEdition;
  /** Wood's persistent, per-tile Chips value. Missing means the base +15. */
  woodBonusChips?: number;
  /** Permanent Chips earned by Golden Type. Missing on legacy saves means 0. */
  bonusChips?: number;
  /** Stone hides its original letter; restoring another material restores it. */
  letterBeforeStone?: Letter;
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
  /** resolved from one representative meaning under the GDD §3.2 precedence */
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
  /** Register after rule-changing Emoji Tiles resolve. This can contain more
   * than one entry (Tower of Babel). `suit` remains null for a gibberish hole. */
  effectiveSuits?: Suit[];
  suit: Suit | null;
  /** the single POS this word occupies in the sequence; null = hole */
  posUsed: POS | null;
  /** layer-1 settled score for this word (committed immediately, GDD §7.1) */
  settledScore: number;
  /** Effective played-word length after rule-changing Emoji Tiles. */
  scoringLength?: number;
  /** Letter-Hand/spelling projection after rule effects; absent on legacy history. */
  structureText?: string;
  /** An active boss or Tag accepted the physical play but short-circuited scoring to 0. */
  debuffed?: boolean;
  /** Played Glass tiles permanently destroyed while this word scored. Kept on
   *  the submission so its tray tiles can remain visibly shattered. */
  destroyedTileIds?: string[];
}

// ---------- Sentence patterns (GDD §5) ----------

export type PatternId =
  | 'outcry'
  | 'imperative'
  | 'chant'
  | 'simple'
  | 'descriptive'
  | 'transitive'
  | 'ditransitive'
  | 'compound'
  | 'objectComplement'
  | 'interrogative'
  | 'negative'
  | 'complex';

export type LetterHandId =
  | 'twin'
  | 'triplet'
  | 'longword'
  | 'palindrome'
  | 'vowelFlush'
  | 'straight'
  | 'typeEconomy'
  | 'vowelless'
  | 'grandPalindrome';

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

export type RegisterSynergyId = 'harmony' | 'contrast' | 'whiplash' | 'mishmash';

/** Mixed-register bonus judged from final register membership (GDD §5.3). */
export interface RegisterSynergyResult {
  id: RegisterSynergyId;
  chipsFactor: number;
}

/** Result of judging a whole sequence (GDD §5): best pattern + one register bonus. */
export interface SentenceJudgment {
  /** the highest-rank matching pattern, or null (no match / a gibberish hole) */
  match: PatternMatch | null;
  /** unison bonus if 2+ words share one suit, else null */
  unison: UnisonResult | null;
  /** mixed-register synergy; mutually exclusive with Unison */
  registerSynergy?: RegisterSynergyResult | null;
  /** Per eligible word, the lexical POS choices compatible with an equivalent
   * winning parse. Ephemeral judgment output; never persisted on submissions. */
  compatiblePos?: readonly (readonly POS[])[] | null;
}

// ---------- Scoring (GDD §7) ----------

/**
 * The mutable context passed through joker hooks while one word is scored.
 * Jokers mutate chips/mult in registration order (Balatro-style left-to-right).
 */
export interface WordScoringContext {
  submission: WordSubmission;
  /** Tiles used for lexicon spelling after rule effects such as Stone Tongue. */
  spellingTiles?: readonly Tile[];
  chips: number;
  mult: number;
  /** Lexicon register before rule-changing Emoji Tiles rewrite the submission. */
  baseSuit?: Suit | null;
  /** Gold awarded by per-word Emoji Tile hooks. Applied by the caller after scoring. */
  goldDelta?: number;
  /** Lexicon POS tags for the current valid word; empty for gibberish. */
  posTags?: readonly POS[];
  /** Virtual vowels supplied by rule-changing Emoji Tiles. */
  scoringVowels?: Set<Letter>;
  /** Extra full-tile triggers requested by Emoji Tiles, keyed by tile id. */
  tileRetriggers?: Map<string, string[]>;
  tileRetriggerInstances?: Map<string, Array<number | undefined>>;
  /** Word-scoped de-duplication for effects whose unit is distinct across the word. */
  resolvedJokerUnits?: Set<string>;
  /** Final register membership supplied by rule-changing Emoji Tiles. */
  scoringSuits?: Set<Suit>;
  /** Flat committed-score replay, used by Rotary Press. */
  scoreBonus?: number;
}

/** Played-word length with a legacy-save fallback to the physical tile count. */
export const submissionLength = (
  submission: Pick<WordSubmission, 'scoringLength' | 'tiles'>,
): number => submission.scoringLength ?? submission.tiles.length;

/** Final register membership, with a legacy-save fallback to the lexicon suit. */
export const submissionSuits = (
  submission: Pick<WordSubmission, 'effectiveSuits' | 'suit'>,
): readonly Suit[] =>
  submission.effectiveSuits !== undefined
    ? submission.effectiveSuits
    : submission.suit === null
      ? []
      : [submission.suit];

export const submissionHasSuit = (
  submission: Pick<WordSubmission, 'effectiveSuits' | 'suit'>,
  suit: Suit,
): boolean => submissionSuits(submission).includes(suit);

/** Seeded pass/fail result exposed to presentation. The engine records the
 * committed roll; the UI never re-rolls or infers it from the resulting state. */
export interface ChanceResult {
  chance: number;
  outcome: 'success' | 'failure' | 'survived' | 'destroyed';
  label?: 'mult' | 'gold' | 'edition' | 'destruction';
  /** Present for object-lifecycle rolls resolved outside the scoring timeline. */
  sourceId?: string;
  sourceEdition?: JokerEdition;
}

/**
 * Ordered steps of settling one word (GDD §7.1 layer 1). The engine records
 * these per submission; the UI replays them for the settle animation
 * (UI_DESIGN §4.1). Pure data — no timing, no DOM.
 */
export type ScoreEvent =
  | { kind: 'tile'; tileId: string; letter: Letter | null; chips: number }
  | { kind: 'material'; material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number; multFactor?: number; goldDelta?: number; chanceResults?: ChanceResult[] }
  | { kind: 'font'; font: TileFont; effect: FontEffectId; tileId: string; chipsDelta: number; multDelta: number; goldDelta: number }
  | { kind: 'edition'; edition: TileEdition | JokerEdition; tileId?: string; jokerId?: string; jokerInstanceId?: number; chipsDelta: number; multDelta: number; multFactor?: number }
  | { kind: 'suit'; suit: Suit | null; mult: number }
  | { kind: 'wordLength'; letters: number; multDelta: number }
  | { kind: 'letterHand'; hand: LetterHandId; level: number; chipsDelta: number; multDelta: number; multFactor: number }
  | { kind: 'joker'; jokerId: string; jokerInstanceId?: number; chipsDelta: number; multDelta: number; chipsFactor?: number; multFactor?: number; scoreDelta?: number; goldDelta?: number; tileId?: string; retrigger?: boolean; growthKind?: 'mult' | 'multAdd' | 'chips' | 'gold' | 'handSize'; growthDelta?: number; createdTileIds?: string[]; sourceTileId?: string }
  | { kind: 'tag'; tagId: SkipRewardId; chipsDelta: number; multDelta: number; scoreDelta?: number; tileId?: string; retrigger?: boolean }
  | { kind: 'boss'; bossId: string; chipsDelta: number; multDelta: number; chipsFactor?: number; multFactor?: number }
  | { kind: 'pouch'; pouchId: PouchId; chipsDelta: number; multDelta: number }
  | { kind: 'settle'; chips: number; mult: number; total: number };

export interface SentenceScoringContext {
  sequence: WordSubmission[];
  match: PatternMatch | null;
  unison: UnisonResult | null;
  registerSynergy?: RegisterSynergyResult | null;
  /** running blind total used as the sentence settlement's current Chips axis */
  totalBefore: number;
  /** Chips added to totalBefore after any register ×Chips gain is materialized. */
  sentenceChips: number;
  /** Mult factor applied to the combined Chips axis: patternMult × unisonMult (GDD §5.2) */
  sentenceMult: number;
  /** Flat score added after the sentence Chips x Mult axes resolve. */
  scoreBonus?: number;
  /** Emoji Tile effects that need their own blind-end trigger presentation. */
  jokerTriggers?: SentenceJokerTrigger[];
}

export interface SentenceJokerTrigger {
  jokerId: string;
  jokerIndex: number;
  chipsDelta: number;
  multFactor: number;
}

/** Player-facing sources folded into the finalized sentence bonus. */
export interface SentenceBonusBreakdown {
  modifierCount: number;
  modifierChips: number;
  unisonSuit: Suit | null;
  unisonChips: number;
  unisonMult: number;
  registerSynergyId: RegisterSynergyId | null;
  registerSynergyChipsFactor: number;
  /** Post-pattern effects from Emoji Tiles, vouchers, or bosses. */
  effectChips: number;
  effectMult: number;
  /** Flat post-sentence score from data-driven effects. */
  effectScore?: number;
  jokerTriggers?: SentenceJokerTrigger[];
  /** Final Starting-Pouch axis transform, kept separate from ordinary effects. */
  pouchId: PouchId | null;
  pouchChipsDelta: number;
  pouchMultDelta: number;
}

// ---------- Blind / Ante / Run state (GDD §8) ----------

export type BlindKind = 'small' | 'big' | 'boss';

/** Publishing-world rewards offered for skipping Draft or Revision (GDD §8.2). */
export type SkipRewardId =
  | 'advancePayment'
  | 'houseStyle'
  | 'extraPages'
  | 'copyPass'
  | 'quotaRelief'
  | 'publicity'
  | 'coverQuote'
  | 'uncommonTag'
  | 'rareTag'
  | 'whiteTag'
  | 'violetTag'
  | 'rainbowTag'
  | 'grayTag'
  | 'investmentTag'
  | 'voucherTag'
  | 'bossTag'
  | 'tileTag'
  | 'fableTag'
  | 'constellationTag'
  | 'charmTag'
  | 'handyTag'
  | 'garbageTag'
  | 'inkTag'
  | 'couponTag'
  | 'jugglerTag'
  | 'economyTag'
  | 'alphaOmegaTag'
  | 'lipogramTag'
  | 'scarletTag'
  | 'pythagoreanYTag';

/** The reward is rolled and fully disclosed before the player chooses to skip. */
export interface SkipRewardOffer {
  id: SkipRewardId;
  /** House Style's exact sentence pattern is part of the disclosed offer. */
  pattern?: PatternId;
  /** Letter-bound Tags disclose their seeded letter before the skip decision. */
  letter?: Letter;
}

/** Bonuses carried until the next blind the player actually chooses to play. */
export interface NextBlindBonus {
  phases: number;
  discards: number;
  handSize: number;
  targetMultiplier: number;
  startingScore: number;
  /** Disclosed letters whose valid words are debuffed in the next played blind. */
  lipogramLetters: Letter[];
  /** Disclosed letters whose physical tiles retrigger in the next played blind. */
  scarletLetters: Letter[];
  /** Extra clear reward attached to the next played blind only. */
  clearRewardBonus: number;
}

/** Starting-pouch choice. Display names live in i18n; engine ids stay stable. */
export type PouchId =
  | 'yellow'
  | 'blue'
  | 'green'
  | 'purple'
  | 'lucky'
  | 'fiveColor'
  | 'golden'
  | 'leather'
  | 'military'
  | 'luxury'
  | 'pencilCase'
  | 'lunchBag'
  | 'shoppingBasket'
  | 'coinPurse';

/** Cumulative Record difficulty choice. */
export type RecordId =
  | 'whiteLp'
  | 'redLp'
  | 'greenLp'
  | 'blueLp'
  | 'yellowLp'
  | 'clearLp'
  | 'cd'
  | 'dvd';

/** Fixed Pouch + Record challenge preset. */
export type ChallengeId =
  | 'redPen'
  | 'risingQuota'
  | 'narrowDesk'
  | 'threePasses'
  | 'balancedBurden'
  | 'randomFinal';

export interface BlindState {
  kind: BlindKind;
  bossId: string | null; // from data/bosses, only when kind === 'boss'
  target: number;
  /** Opening/draw-back hand size after boss and carried skip-reward modifiers. */
  handSizeTotal: number;
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
  earlyEndDisabled?: boolean; // dormant early-end lock (no boss in the current roster sets it)
  previewHidden?: boolean; // dormant preview-hide flag (UI hides the projected preview)
  vowelsHidden?: boolean; // Ancient Paper (고대 문서): vowel tiles drawn face-down (UI only)
  /** Nokdo Script: this hand tile must remain staged and be included in Play.
   *  Consumables may still transform or destroy it. */
  forcedTileId?: string | null;
  /** Blueprint: Emoji Tile identities are hidden for this blind. */
  jokersFaceDown?: boolean;
  /** Dead Letter's seeded forbidden letter for this Deadline. */
  deadLetter?: Letter | null;
  /** Next-blind Tag state copied in before the carry is consumed. */
  lipogramLetters?: Letter[];
  scarletLetters?: Letter[];
  clearRewardBonus?: number;
}

export interface RunState {
  pouchId: PouchId;
  recordId: RecordId;
  /** Active fixed challenge preset; null/absent legacy values are ordinary runs. */
  challengeId?: ChallengeId | null;
  /** Explicit seed entered on New Run; these runs grant no pouch/record unlocks. */
  customSeed: boolean;
  seed: string; // seeded RNG — reproducible runs (roguelite requirement)
  ante: number; // 1..8, then endless
  /** Chapter 8 Deadline already cleared. Endless failure never revokes this win. */
  victorySecured: boolean;
  blindIndex: 0 | 1 | 2; // small / big / boss
  /** Fixed, seeded Draft/Revision skip rewards for the current Chapter. */
  skipOffers: [SkipRewardOffer, SkipRewardOffer];
  /** Which non-Deadline stages were skipped in the current Chapter. */
  skippedThisChapter: (0 | 1)[];
  /** Lifetime count within this run; balance telemetry and future hooks read it. */
  skippedBlinds: number;
  /** Distinct physical letters discarded earlier in this run (Cadmus's Teeth). */
  discardedLetters?: Letter[];
  /** Real Stationery Shops entered; absent legacy values mean none visited yet. */
  shopsVisited?: number;
  /** Stacks across consecutive skips and is consumed only when Play is chosen. */
  nextBlindBonus: NextBlindBonus;
  /** Stacks across skips and is consumed by the next successfully cleared blind. */
  pendingClearReward: number;
  /** Shop-facing tags wait here until a generated shop can apply them. */
  pendingShopTags: SkipRewardId[];
  /** Investment Tags stack until the next successfully cleared Deadline. */
  pendingBossReward: number;
  gold: number;
  handSize: number; // base 10, a balance knob (GDD §6.2)
  basePhases: number; // base 5
  baseDiscards: number; // base 4
  bag: Tile[]; // the permanent 68-tile (sculpted) asset
  jokers: OwnedJoker[];
  /** Next stable physical Emoji Tile identity; optional only on legacy saves. */
  nextJokerInstanceId?: number;
  /** Bounded headless presentation log for non-scoring lifecycle growth. */
  jokerGrowthSequence?: number;
  lifecycleGrowthEvents?: Array<{
    sequence: number;
    jokerId: string;
    jokerInstanceId?: number;
    kind: 'mult' | 'multAdd' | 'chips' | 'gold' | 'handSize';
    delta: number;
  }>;
  consumables: ConsumableId[];
  /** Last used Fable/Constellation card, for The Boy Who Cried Wolf. */
  lastFableOrConstellation?: ConsumableId | null;
  /** Number of Fable cards successfully used during this run. */
  fablesUsed?: number;
  consumableSlots: number; // base 2
  jokerSlots: number; // base 5; Kung Fu Manual adds one
  patternLevels: Record<PatternId, number>;
  patternPlayCounts: Record<PatternId, number>;
  /** Hidden sentence patterns activated during this run; optional on legacy saves. */
  discoveredPatterns?: PatternId[];
  vouchers: VoucherId[];
  /** the current chapter's offered voucher (fixed per chapter; playtest-03 C) */
  voucherOffer: VoucherId | null;
  /** a voucher was already bought this chapter — the slot is greyed until next chapter */
  voucherLocked: boolean;
  /** Base vouchers redeemed this chapter. Their upgrades skip the next restock once.
   *  Optional only for saves created before the cooldown rule. */
  voucherBasesBoughtThisChapter?: VoucherId[];
  /** this chapter's Deadline boss, drawn at chapter start so Blind Select can
   *  always show its effect (playtest-04 D-6) */
  chapterBossId: string | null;
  /** Bosses drawn in each pool's current no-repeat cycle. Optional for legacy saves. */
  bossHistory?: string[];
  /** lowercased words submitted so far THIS ante (small + big + boss phases).
   *  Reset when a new ante begins; read by the Memoirs boss (회고록) to debuff
   *  any word already played this ante (GDD §8.3). */
  wordsThisAnte: string[];
  /** Unique valid words submitted across the whole run. Optional for legacy saves. */
  playedWords?: string[];
  /** Unique Word Hand ids made across the whole run. Optional for legacy saves. */
  playedLetterHands?: LetterHandId[];
  /** Times each Word Hand scored across the whole run. Optional for legacy saves. */
  letterHandPlayCounts?: Partial<Record<LetterHandId, number>>;
  /** Current run-only Word Hand levels and unspent mastery stamps. */
  letterHandLevels?: Partial<Record<LetterHandId, number>>;
  letterHandStamps?: Partial<Record<LetterHandId, number>>;
  /** Most recently scored Word Hand, used by The Crow and the Pitcher. */
  lastLetterHand?: LetterHandId | null;
  /** Physical discard counts by letter across the run. Optional for legacy saves. */
  discardedLetterCounts?: Partial<Record<Letter, number>>;
  /** Boss rerolls spent this chapter; reset when the Deadline clears. */
  bossRerollsUsed: number;
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
  /** Discard actions left unused on successfully cleared blinds this run. */
  unusedDiscards: number;
}

// ---------- Shop (GDD §9.2) ----------

/** One purchasable in a shop item slot. `null` in a slot means bought/empty. */
export type ShopItem = {
  /** Explicit free-offer provenance (Tags); dynamic discounts reaching $0 are not free. */
  free?: true;
} & (
  | {
      kind: 'joker';
      id: string;
      edition?: JokerEdition;
      price: number;
      /** Guaranteed rarity-tag stock stays beside ordinary items on reroll. */
      rarityTag?: 'uncommonTag' | 'rareTag';
      /** Development-build fixture retained across rerolls of the first shop. */
      developerPinned?: true;
    }
  | { kind: 'consumable'; id: ConsumableId; price: number }
  | { kind: 'punctuation'; id: ConsumableId; pattern: PatternId; price: number }
  | { kind: 'tile'; tile: Tile; price: number }
);

/** Pack types (GDD §9.3). Publishing-world names live in i18n:
 *  pattern=Ink · joker=Charm · consumable=Consumable · tile=Tile.
 *  Code ids are semantic, not the display names. (Forbidden Stacks retired 2026-07-22.) */
export type PackType = 'pattern' | 'joker' | 'consumable' | 'tile' | 'ink';

/** Pack sizes (GDD §9.3, feature-02 B): Normal 3/1 · Jumbo 5/1 · Mega 5/2. */
export type PackSize = 'normal' | 'jumbo' | 'mega';

/** A shop pack slot: any type × any size (weights in balance.ts). */
export interface PackSlot {
  type: PackType;
  size: PackSize;
  /** Coupon Tag makes only the next shop's initially stocked packs free. */
  free?: boolean;
  /** cosmetic art-variant index for this size, seeded at stock time (UI maps it
   *  to a PNG in packArt.ts). Purely presentational — no gameplay effect. */
  artVariant: number;
}

export interface ShopState {
  items: (ShopItem | null)[];
  /** single voucher slot, restocks each ante (GDD §9.2); null when owned/bought */
  voucher: VoucherId | null;
  /** Voucher Tag adds one extra choice; both choices may be bought in that shop. */
  bonusVoucher: VoucherId | null;
  /** pack slots (null = bought) */
  packs: (PackSlot | null)[];
  /** rerolls done this visit — drives the escalating reroll cost */
  rerolls: number;
  /** Reroll Tag changes this visit's cost progression to $0, $1, $2... */
  rerollBase?: number;
}

// ---------- Jokers (GDD §11) ----------

export type JokerRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'primordial';
export type JokerEdition = 'base' | 'gray' | 'violet' | 'rainbow' | 'white';

export interface OwnedJoker {
  defId: string;
  /** Stable physical identity used by copied-effect state across shelf moves/saves. */
  instanceId?: number;
  /** Missing only on legacy saves/test fixtures; engine treats it as `base`. */
  edition?: JokerEdition;
  /** per-instance mutable state for scaling jokers (e.g. Classicist's grown mult) */
  state: Record<string, number>;
}

// ---------- Consumables & vouchers (GDD §9–10) ----------

/** Every id the engine can resolve. `src/engine/consumables.ts` keeps the runtime
 *  list in step; a retired id is deleted from BOTH and filtered out of old saves. */
export type ConsumableId =
  // stationery
  | 'magnifier'
  // constellation cards (1:1 with the 12 sentence patterns)
  | 'libra' | 'leo' | 'aquarius' | 'aries' | 'taurus' | 'gemini'
  | 'cancer' | 'virgo' | 'scorpio' | 'sagittarius' | 'capricorn' | 'pisces'
  // fable cards
  | 'fable1' | 'fable2' | 'fable3' | 'fable4' | 'fable5' | 'fable6'
  | 'fable7' | 'fable8' | 'fable9' | 'fable10' | 'fable11' | 'fable12'
  | 'fable13' | 'fable14' | 'fable15' | 'fable16' | 'fable17' | 'fable18'
  | 'fable19' | 'fable20'
  // gambler cards (GDD §10.3)
  | 'barnSwallow' | 'boar' | 'bridge' | 'bushWarbler' | 'butterflies'
  | 'craneAndSun' | 'cuckoo' | 'curtain' | 'deer' | 'fullMoon'
  | 'geese' | 'phoenix' | 'rainman' | 'sakeCup';

export type VoucherId =
  | 'storyBook' | 'novel'
  | 'bible' | 'theLaw'
  | 'fashionBook' | 'fashionMagazine'
  | 'flyer' | 'wantedPoster'
  | 'newspaper' | 'papyrus'
  | 'memo' | 'notebook'
  | 'poetryBook' | 'sheetMusic'
  | 'fourCutPhoto' | 'pictureDiary'
  | 'enKoDictionary' | 'encyclopedia'
  | 'receipt' | 'householdLedger'
  | 'sketchBook' | 'portrait'
  | 'catalog' | 'couponBook'
  | 'historyBook' | 'oldBook'
  | 'blankPaper' | 'kungfuManual'
  | 'bwPhoto' | 'yearBook'
  | 'zeroScore' | 'comicBook';
