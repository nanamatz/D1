/**
 * BALANCE — every tunable number in the game, in one place.
 *
 * Rule: no magic numbers anywhere in src/engine. If a value appears in a
 * GDD table marked "placeholder", it lives here. The headless simulator
 * (src/sim) sweeps these values; playtesting overwrites them.
 * GDD section references are noted per block.
 */

export const BALANCE = {
  // ----- Core loop (GDD §6) -----
  handSize: 11,
  basePhases: 4,
  discardsPerBlind: 3, // per-blind count; no per-use tile cap (playtest-04 D-4)

  // ----- Scrabble letter values (GDD §2.1) -----
  letterChips: {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
    N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
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

  // ----- Sentence patterns (GDD §5.2) -----
  patterns: {
    outcry:       { rank: 1, op: 'add' as const,      flatChips: 20 },
    imperative:   { rank: 2, op: 'add' as const,      flatChips: 40, flatMult: 2 },
    chant:        { rank: 3, op: 'add' as const,      perRepeatChips: 15, perRepeatMult: 1.5 },
    simple:       { rank: 4, op: 'add' as const,      flatChips: 60, flatMult: 3 },
    descriptive:  { rank: 5, op: 'multiply' as const, totalMult: 1.5 },
    transitive:   { rank: 6, op: 'multiply' as const, totalMult: 2.0 },
    ditransitive: { rank: 7, op: 'multiply' as const, totalMult: 2.5 },
    compound:     { rank: 8, op: 'multiply' as const, totalMult: 3.0 },
  },

  /** modifier absorption bonuses (GDD §5.1 rule 3) */
  modifierAbsorption: { addPatternChips: 15, multiplyPatternMult: 0.15 },

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

  /** punctuation level-up per level (GDD §5.4) */
  punctuationLevel: {
    outcry:       { chips: 10 },
    imperative:   { chips: 15, mult: 1 },
    chant:        { perRepeatChips: 5, perRepeatMult: 0.5 },
    simple:       { chips: 20, mult: 1 },
    descriptive:  { totalMult: 0.25 },
    transitive:   { totalMult: 0.25 },
    ditransitive: { totalMult: 0.3 },
    compound:     { totalMult: 0.3 },
  },

  // ----- Unison bonus (GDD §5.3) -----
  unison: {
    minWords: 2,
    standard: { flatChips: 50 },
    formal:   { totalMult: 1.25 },
    slang:    { totalMult: 1.5 },
    vulgar:   { totalMult: 2.0 },
  },

  // ----- Blinds & antes (GDD §8.2) -----
  blindTargetMult: { small: 1.0, big: 1.5, boss: 2.0 },
  anteBaseTargets: [100, 300, 800, 2000, 5000, 11000, 20000, 35000], // placeholder curve, antes 1..8
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

  // ----- Packs (GDD §9.3) -----
  packPrice: { letter: 4, emoji: 6, consumable: 4 } as Record<string, number>,
  pack: {
    letter: { show: 4, pick: 2 }, // 3–5 tiles shown, choose 1–2
    emoji: { show: 3, pick: 1 }, // 2–4 jokers, choose 1
    consumable: { show: 3, pick: 1 },
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
    snobStandardMult: 0.5,
    guillotinePhaseDelta: -2,
    editorMinLength: 5, // words of 4 letters or fewer score 0
    taxmanGoldPerWord: 1,
  },
} as const;

export type Balance = typeof BALANCE;
