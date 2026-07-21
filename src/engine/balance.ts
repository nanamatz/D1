/**
 * BALANCE — every tunable number in the game, in one place.
 *
 * Rule: no magic numbers anywhere in src/engine. If a value appears in a
 * GDD table marked "placeholder", it lives here. The headless simulator
 * (src/sim) sweeps these values; playtesting overwrites them.
 * GDD section references are noted per block.
 */

import type { FontEffectId, TileFont } from './types';

export const BALANCE = {
  // ----- Core loop (GDD §6) -----
  handSize: 11,
  basePhases: 5,
  discardsPerBlind: 4, // per-blind count; no per-use tile cap (playtest-04 D-4)

  // ----- Letter values (GDD §2.1) — Scrabble ratios × 3 (feel pass 2026-07-21):
  //       raise the base floor so tiles feel impactful; ratios (rare-letter payoff)
  //       are preserved. Only these scale — pattern/unison/hand/material constants
  //       do not. Sim: src/sim/feel-chip-scale.ts verifies antes don't trivialize. -----
  letterChips: {
    A: 3, B: 9, C: 9, D: 6, E: 3, F: 12, G: 6, H: 12, I: 3, J: 24, K: 15, L: 3, M: 9,
    N: 3, O: 3, P: 9, Q: 30, R: 3, S: 3, T: 3, U: 3, V: 12, W: 12, X: 24, Y: 12, Z: 30,
  } as Record<string, number>,

  /**
   * Starting bag composition (GDD §2.1): letter → count, total 68. Diverges from
   * Scrabble on purpose (playtest-04 C-2, chosen by `src/sim/tile-pool.ts`):
   * shrunk from 98 and compressed extremes (E 12→6, rares 1→2) so rare letters
   * appear ~2× as often per hand — more diversity + deck-building traction —
   * while makeable-word supply stays healthy and the gibberish-forced rate stays
   * near zero. Scrabble assumes board-adjacency; standalone spelling wants flatter.
   */
  bagComposition: {
    A: 5, B: 2, C: 2, D: 2, E: 6, F: 2, G: 2, H: 2, I: 5, J: 2, K: 2, L: 2, M: 2,
    N: 3, O: 4, P: 2, Q: 2, R: 3, S: 2, T: 3, U: 3, V: 2, W: 2, X: 2, Y: 2, Z: 2,
  } as Record<string, number>,

  // ----- Suit base multipliers (GDD §3.1) -----
  suitMult: { standard: 1.0, formal: 1.5, slang: 2.0, vulgar: 3.0 },

  // ----- Gibberish (GDD §6.4, decision b-2) -----
  gibberish: { mult: 1.0 }, // letter chips × 1.0; no suit, no POS, leaves a hole

  /**
   * Materials (GDD §2.2). First-pass values are Balatro's enhancement numbers
   * VERBATIM — a validated reference point to tune from, not a claim they fit
   * our scale. See docs/superpowers/specs/2026-07-17-tile-materials-design.md
   * for the three predicted breakages src/sim should measure.
   */
  materials: {
    porcelain: { chips: 30 }, // Balatro Bonus
    polished: { mult: 4 }, // Balatro Mult
    glass: { multFactor: 2, destroyChance: 0.25 }, // Balatro Glass
    stone: { chips: 50 }, // Balatro Stone
    leadPlate: { multChance: 0.2, mult: 20, goldChance: 1 / 15, gold: 20 }, // Balatro Lucky
    ivory: { gold: 3 }, // Balatro Gold
    brass: { multFactor: 1.5 }, // Balatro Steel
  },

  /**
   * Font seal effects (GDD §2.3) — Balatro-seal values verbatim-then-tune,
   * same philosophy as materials above.
   */
  fontEffectValues: {
    goldPlay: { gold: 3 }, // Gold Seal
    chipPlay: { chips: 30 }, // adapted (Blue Seal has no planet analog; Bonus-card value)
    retriggerPlay: { extraTriggers: 1 }, // Red Seal — the reserved retrigger, spent here
    discardGain: {}, // Purple Seal (tarot → consumable)
  },
  // PROVISIONAL — awaiting design mapping (GDD §2.3/§12): reassigning a font is
  // a one-line change here; tooltips and scoring read this table.
  fontEffects: {
    lightItalic: 'goldPlay',
    bold: 'chipPlay',
    inline: 'retriggerPlay',
    black: 'discardGain',
  } as Record<Exclude<TileFont, 'medium'>, FontEffectId>,

  // ----- Sentence patterns (GDD §5.2) — unified base Chips × Mult (feature-02 A).
  //       Every pattern owns a base [chips × mult]; leveling raises both by
  //       [levelChips, levelMult] per level above 1. The sentence bonus is a
  //       self-contained (chips × mult) value ADDED to the blind score — patterns
  //       no longer multiply the running word total (the old add/multiply op split
  //       is retired). Chant additionally adds `repeatChips` per repeat beyond the
  //       3rd (`repeatFloor`), itself +`repeatLevelChips` per level. -----
  patterns: {
    outcry:       { rank: 1, baseChips: 10, baseMult: 1, levelChips: 10, levelMult: 0.5 },
    imperative:   { rank: 2, baseChips: 15, baseMult: 2, levelChips: 10, levelMult: 0.5 },
    chant:        { rank: 3, baseChips: 15, baseMult: 2, levelChips: 10, levelMult: 0.5, repeatChips: 10, repeatLevelChips: 5, repeatFloor: 3 },
    simple:       { rank: 4, baseChips: 25, baseMult: 2, levelChips: 15, levelMult: 1 },
    descriptive:  { rank: 5, baseChips: 30, baseMult: 3, levelChips: 15, levelMult: 1 },
    transitive:   { rank: 6, baseChips: 40, baseMult: 3, levelChips: 20, levelMult: 1 },
    ditransitive: { rank: 7, baseChips: 50, baseMult: 4, levelChips: 25, levelMult: 1.5 },
    compound:     { rank: 8, baseChips: 60, baseMult: 4, levelChips: 30, levelMult: 1.5 },
  },

  /** modifier absorption bonus (GDD §5.1 rule 3): +chips per absorbed modifier,
   *  uniform on the Chips side for every pattern (the old multiply-pattern variant is gone). */
  modifierAbsorption: { chips: 15 },

  // ----- Letter hands (playtest-02 A-2) — per-word structure bonuses, applied
  //       inside WordScoringContext before the suit multiplier settles. Highest
  //       single hand only. rank 1 (weakest) .. 6 (strongest). -----
  letterHands: {
    twin:       { rank: 1, chips: 10, mult: 0 },
    triplet:    { rank: 2, chips: 20, mult: 1 },
    longword:   { rank: 3, chips: 30, mult: 1 },
    palindrome: { rank: 4, chips: 30, mult: 2 },
    vowelFlush: { rank: 5, chips: 50, mult: 3 },
    straight:   { rank: 6, chips: 60, mult: 4 },
  },
  /** min word length for the Longword hand, and min length for Palindrome to count */
  letterHand: { longwordLen: 7, palindromeMinLen: 3, straightRun: 6 },

  // Punctuation level-ups are now uniform per pattern via `patterns.*.levelChips /
  // levelMult` (feature-02 A) — the separate punctuationLevel table is retired.

  // ----- Unison bonus (GDD §5.3) — folds into the sentence formula (feature-02 A):
  //       `standard` adds to the Chips side, the register mults multiply the Mult
  //       side. Values unchanged from the prior scheme. -----
  unison: {
    minWords: 2,
    standard: { chips: 50 },
    formal:   { mult: 1.25 },
    slang:    { mult: 1.5 },
    vulgar:   { mult: 2.0 },
  },

  // ----- Blinds & antes (GDD §8.2) -----
  blindTargetMult: { small: 1.0, big: 1.5, boss: 2.0 },
  // placeholder curve, antes 1..8. Feel pass 2026-07-21: left UNCHANGED after the
  // letterChips ×3 scaling — src/sim/feel-chip-scale.ts (200 seeds/ante, greedy
  // best-word) shows ante 1 clearing 77.5% (not near-100%-with-phases-to-spare)
  // and antes 2-4 falling off sharply, so the curve is not trivialized.
  anteBaseTargets: [100, 300, 800, 2000, 5000, 11000, 20000, 35000],
  runAntes: 8,

  // ----- Economy (GDD §9.1) -----
  startingGold: 4, // Balatro-parity starting stake (placeholder)
  clearReward: { small: 3, big: 4, boss: 5 },
  goldPerRemainingPhase: 1,
  interest: { per: 5, rate: 1, cap: 5 },
  sellRatio: 0.5,

  // ----- Shop (GDD §9.2) -----
  shop: { itemSlots: 2, packSlots: 2, rerollBase: 5, rerollIncrement: 1 },
  jokerPrice: { common: 5, uncommon: 7, rare: 9, legendary: 20 },
  jokerSlots: 5, // Balatro-parity joker cap (placeholder)
  consumablePrice: 3, // flat consumable price (placeholder, GDD §9.2)

  // ----- Vouchers (GDD §9.4) — single tier, 9 -----
  voucherPrice: {
    extraHand: 6, extraDiscard: 6, overtime: 10, regularsDiscount: 5, compoundInterest: 7,
    thrift: 5, wideShelf: 7, connoisseur: 6, pencilCase: 6,
  } as Record<string, number>,
  voucher: {
    rerollDiscount: 2, // Regular's Discount
    interestCap: 10, // Compound Interest (base cap 5 → 10)
    thriftPerDiscard: 1, // Thrift: gold per unused discard on blind end
    wideShelfSlots: 1, // Wide Shelf: +1 shop item slot
  },

  // ----- Packs (GDD §9.3, feature-02 B) — 5 types × 3 sizes -----
  pack: {
    // size governs how many are shown / picked, and the price (Balatro 4/6/8).
    size: {
      normal: { show: 3, pick: 1, price: 4 },
      jumbo:  { show: 5, pick: 1, price: 6 },
      mega:   { show: 5, pick: 2, price: 8 },
    },
    // shop pack-slot roll weights. Forbidden Stacks is rare; Mega/Jumbo rarer.
    typeWeights: { pattern: 4, joker: 4, consumable: 4, tile: 4, forbidden: 1 } as Record<string, number>,
    sizeWeights: { normal: 6, jumbo: 3, mega: 1 } as Record<string, number>,
  },
  packEnhanceChance: { base: 0.15, connoisseur: 0.4 }, // material/font pre-attach rate

  // ----- Jokers (GDD §11) — per-joker knobs (proof set for slice ④) -----
  jokers: {
    vowelPraise: { multPerVowel: 2 }, // #1
    consonantBricklayer: { chipsPerConsonant: 4 }, // #2
    jackOfAllTrades: { mult: 4 }, // #10
    hipster: { mult: 7 }, // #12, layer 2 (Slang)
    grammarian: { totalMult: 2 }, // #22, layer 3 (any pattern)
    // #24, layer 3 — proportional to phases left at clear (playtest-04 C-1):
    // ×(1 + multPerPhase × phasesLeft). More phases left → bigger bonus.
    rushSpecialist: { multPerPhase: 0.5 },
    loanShark: { goldPerPhase: 1 }, // #28 (not yet implemented) — $ per phase left at clear
  },

  // ----- Consumables (GDD §10) -----
  consumableSlots: 2,
  piggyBankCap: 20,

  // ----- Boss effects (GDD §8.3) — per-boss knobs -----
  boss: {
    wantedTargetMult: 2, // Wanted: XL blind, target ×2 (수배 전단)
    letterDiscardOnPlay: 4, // Unopened Letter: discard up to 4 random hand tiles per play (미개봉 편지)
    bondGoldPerTile: 1, // Bond: −$1 per tile played (채권)
    historyBookPhases: 2, // History Book: only 2 phases (역사책)
    budgetBookHandDelta: -3, // Budget Book: hand size −3 (가계부)
    willScale: 0.5, // Will: base chips & mult ×0.5 (유서)
  },
} as const;

export type Balance = typeof BALANCE;
