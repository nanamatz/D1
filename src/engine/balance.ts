/**
 * BALANCE — every tunable number in the game, in one place.
 *
 * Rule: no magic numbers anywhere in src/engine. If a value appears in a
 * GDD table marked "placeholder", it lives here. The headless simulator
 * (src/sim) sweeps these values; playtesting overwrites them.
 * GDD section references are noted per block.
 */

import type {
  FontEffectId,
  JokerEdition,
  Letter,
  PackSize,
  PackType,
  TileFont,
} from './types';

const patternDifficultyLevelChips = { easy: 15, medium: 30, hard: 45 } as const;

export const BALANCE = {
  // ----- Core loop (GDD §6) -----
  handSize: 10,
  basePhases: 5,
  discardsPerBlind: 4, // per-blind count; no per-use tile cap (playtest-04 D-4)

  // ----- Starting pouches + cumulative Record difficulty (GDD §12) -----
  pouches: {
    yellow: { discards: 1 },
    blue: { phases: 1 },
    green: { gold: 10 },
    purple: { phaseGold: 2, discardGold: 1 },
    fiveColor: { handSize: 1, jokerSlots: -1 },
    leather: { jokerSlots: 1, phases: -1 },
    military: { consumableSlots: -1 },
    lunchBag: { targetMult: 2 },
    unlockWords: { blue: 25, green: 50, purple: 100 },
  },
  records: {
    /** Chapter 1 is unchanged; each later chapter compounds this growth. */
    greenTargetGrowth: 1.15,
    blueHandSize: -1,
    yellowDiscards: -1,
    clearPhases: -1,
    cdJokerSlots: -1,
  },

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
  suitMult: { standard: 1, formal: 10, slang: 5, vulgar: 7 },

  // ----- Profile register-title discovery thresholds (GDD §3.1) -----
  // Full-register mastery is derived from the current lexicon, not a number.
  registerTitleThresholds: {
    standard: [50, 100, 200, 500, 1_000, 10_000, 100_000],
    formal: [10, 25, 50, 100, 250, 500, 1_000],
    slang: [5, 10, 25, 50, 100, 250, 500],
    vulgar: [1, 5, 10, 25, 50, 100, 200],
  },

  // ----- Word length (GDD §3.1, 2026-07-30) — length ADDS to Mult, it does not
  //       multiply the suit multiplier: `chips × (suitMult + length × multPerLetter)`.
  //       Additive keeps the suit multiplier weighty instead of swamped. Valid words
  //       only (§6.4). The Longword Word Hand (§5.5) is the Chips side of the same
  //       idea, so the two are not duplicates. Sim: src/sim/length-mult.ts. -----
  wordLength: { multPerLetter: 1, maxLetters: 18 },

  // ----- Gibberish (GDD §6.4, decision b-2) -----
  gibberish: { mult: 1.0 }, // letter chips × 1.0; no suit, no POS, leaves a hole

  /**
   * Materials (GDD §2.2). Values started from Balatro's enhancements, then tune
   * from playtest decisions (Lead plate's gold chance is now 1/5).
   */
  materials: {
    porcelain: { chips: 30 }, // Balatro Bonus
    polished: { mult: 4 }, // Balatro Mult
    glass: { multFactor: 2, destroyChance: 0.25 }, // Balatro Glass
    stone: { chips: 50 }, // Balatro Stone
    leadPlate: { multChance: 0.2, mult: 20, goldChance: 0.2, gold: 20 },
    ivory: { gold: 3 }, // Balatro Gold
    brass: { multFactor: 1.5 }, // Balatro Steel
    wood: { baseChips: 15, chipsPerPlay: 10 },
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
  // Confirmed mapping (GDD §2.3, 2026-07-27): reassigning a font is a one-line
  // change here; tooltips and scoring read this table.
  fontEffects: {
    lightItalic: 'goldPlay',
    bold: 'chipPlay',
    inline: 'discardGain',
    black: 'retriggerPlay',
  } as Record<Exclude<TileFont, 'medium'>, FontEffectId>,

  // ----- Sentence patterns (GDD §5.2) — unified base Chips × Mult (feature-02 A).
  //       Every pattern owns a base [chips × mult]; each level adds a fixed
  //       difficulty-tier Chips increment and +1 Mult. At sentence settlement,
  //       Chips add to the committed blind score and Mult multiplies that combined
  //       Chips axis. Chant additionally adds `repeatChips` per repeat beyond the
  //       2nd (`repeatFloor`), itself +`repeatLevelChips` per level. -----
  patternDifficultyLevelChips,
  patterns: {
    outcry:       { rank: 1, difficulty: 'easy', baseChips: 25, baseMult: 1, levelChips: patternDifficultyLevelChips.easy, levelMult: 1 },
    simple:       { rank: 2, difficulty: 'easy', baseChips: 35, baseMult: 1, levelChips: patternDifficultyLevelChips.easy, levelMult: 1 },
    imperative:   { rank: 3, difficulty: 'easy', baseChips: 40, baseMult: 1, levelChips: patternDifficultyLevelChips.easy, levelMult: 1 },
    transitive:   { rank: 4, difficulty: 'medium', baseChips: 50, baseMult: 2, levelChips: patternDifficultyLevelChips.medium, levelMult: 1 },
    negative:     { rank: 5, difficulty: 'medium', baseChips: 55, baseMult: 2, levelChips: patternDifficultyLevelChips.medium, levelMult: 1 },
    interrogative:{ rank: 6, difficulty: 'easy', baseChips: 60, baseMult: 2, levelChips: patternDifficultyLevelChips.easy, levelMult: 1 },
    descriptive:  { rank: 7, difficulty: 'medium', baseChips: 75, baseMult: 3, levelChips: patternDifficultyLevelChips.medium, levelMult: 1 },
    chant:        { rank: 8, difficulty: 'hard', baseChips: 90, baseMult: 3, levelChips: patternDifficultyLevelChips.hard, levelMult: 1, repeatChips: 10, repeatLevelChips: 10, repeatFloor: 2 },
    objectComplement: { rank: 9, difficulty: 'hard', baseChips: 115, baseMult: 3, levelChips: patternDifficultyLevelChips.hard, levelMult: 1 },
    ditransitive:     { rank: 10, difficulty: 'hard', baseChips: 135, baseMult: 3, levelChips: patternDifficultyLevelChips.hard, levelMult: 1 },
    compound:         { rank: 11, difficulty: 'hard', baseChips: 165, baseMult: 4, levelChips: patternDifficultyLevelChips.hard, levelMult: 1 },
    complex:          { rank: 12, difficulty: 'hard', baseChips: 195, baseMult: 4, levelChips: patternDifficultyLevelChips.hard, levelMult: 1 },
  } as const,
  patternLevelGrowthFactor: 1,

  /** modifier absorption bonus (GDD §5.1 rule 3): +chips per absorbed modifier,
   *  uniform on the Chips side for every pattern (the old multiply-pattern variant is gone). */
  modifierAbsorption: { chips: 15 },

  // ----- Word Hands (playtest-02 A-2) — per-word structure bonuses, applied
  //       inside WordScoringContext: Chips add and Mult multiplies. Highest single
  //       hand only. rank 1 (weakest) .. 9 (strongest). -----
  letterHands: {
    twin:       { rank: 1, chips: 15, mult: 1, levelChips: 5 },
    longword:   { rank: 2, chips: 30, mult: 2, levelChips: 5 },
    triplet:    { rank: 3, chips: 45, mult: 2, levelChips: 5 },
    palindrome: { rank: 4, chips: 45, mult: 3, levelChips: 10 },
    vowelFlush: { rank: 5, chips: 75, mult: 4, levelChips: 10 },
    straight:   { rank: 6, chips: 90, mult: 5, levelChips: 10 },
    typeEconomy:    { rank: 7, chips: 105, mult: 6, levelChips: 15 },
    vowelless:      { rank: 8, chips: 120, mult: 7, levelChips: 15 },
    grandPalindrome:{ rank: 9, chips: 150, mult: 8, levelChips: 15 },
  },
  /** Word-Hand structure thresholds (GDD §5.5). */
  letterHand: {
    longwordLen: 6,
    palindromeMinLen: 3,
    straightRun: 5,
    typeEconomyMinLen: 8,
    vowellessMinLenWhenYConsonant: 5,
    vowellessMinLenWhenYVowel: 3,
    grandPalindromeMinLen: 7,
    levelMultEvery: 3,
    stampCosts: [
      { throughLevel: 5, stamps: 1 },
      { throughLevel: 8, stamps: 3 },
    ],
    lateStampCost: 5,
  },

  // Constellation level-ups are uniform per pattern via `patterns.*.levelChips /
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
  // placeholder curve, antes 1..8. Re-tuned 2026-07-30 for the word-length Mult
  // bonus (§3.1): a 3-6 letter word's effective mult rose ~3x, so the curve scaled
  // ×3 to hold the shape src/sim/feel-chip-scale.ts recorded (ante 1 ~77.5% clear,
  // antes 2-4 falling off sharply). Ante-1 small must also stay above a single
  // YELLOW (252) so the guided intro's first word does not clear the blind (§13).
  // Verified with src/sim/length-mult.ts.
  anteBaseTargets: [300, 900, 2400, 6000, 15000, 33000, 60000, 105000],
  runAntes: 8,
  // Endless begins after Chapter 8. The base and exponent both grow, guaranteeing
  // that the target curve eventually outruns slot-limited player scaling. Chapter
  // 39 would exceed Number's finite range, so Chapter 38 is the explicit finale.
  endless: {
    baseFactor: 1.6,
    growth: 0.75,
    exponentGrowth: 0.2,
    significantDigits: 2,
    maxAnte: 38,
  },

  // ----- Blind skip rewards (GDD §8.2) -----
  // Thirty equally likely publishing-world rewards. Draft and Revision may be
  // skipped; Deadline never may. Delayed blind bonuses carry across another
  // skip so the player always receives them on the next stage they actually play.
  skipRewards: {
    advanceGold: 7,
    patternLevels: 1,
    phases: 1,
    discards: 1,
    targetMultiplier: 0.85,
    clearReward: 5,
    startingScore: 75,
    investmentReward: 25,
    handyGoldPerHand: 1,
    garbageGoldPerDiscard: 1,
    jugglerHandSize: 2,
    economyGoldMultiplier: 2,
    economyGoldCap: 25,
    supplyCommonJokers: 2,
    rerollStartCost: 0,
    lipogramTargetMultiplier: 0.7,
  },

  // ----- Economy (GDD §9.1) -----
  startingGold: 4, // Base run starting Fee before Pouch modifiers
  clearReward: { small: 3, big: 4, boss: 5 },
  goldPerRemainingPhase: 1,
  interest: { per: 5, rate: 1, cap: 5 },
  sellRatio: 0.5,
  minimumEditionSellBonus: 1,

  // ----- Shop (GDD §9.2) -----
  shop: {
    itemSlots: 2,
    packSlots: 2,
    rerollBase: 5,
    rerollIncrement: 1,
    // Balatro reference: Joker 20, Tarot/Planet 4 each; the voucher-gated
    // letter-tile family adds 4 and Lucky Pouch's Gambler family adds 2.
    itemWeights: { joker: 20, tile: 4, consumable: 4, punctuation: 4, gambler: 2 },
  },
  jokerPrice: { common: 4, uncommon: 6, rare: 9, legendary: 15, primordial: 0 },
  jokerEditionPrice: { base: 0, gray: 2, violet: 3, rainbow: 5, white: 5 } as Record<JokerEdition, number>,
  jokerSlots: 5,
  consumablePrice: 3,
  gamblerPrice: 4,
  tilePrice: 1,

  // ----- Vouchers (GDD §9.4) — 16 base + 16 unlocked upgrades -----
  voucherPrice: 10,
  voucher: {
    rerollDiscount: 2,
    baseInterestCap: 10,
    upgradedInterestCap: 20,
    baseShopDiscount: 0.25,
    upgradedShopDiscount: 0.5,
    baseShopWeightMultiplier: 2,
    upgradedShopWeightMultiplier: 8,
    bossRerollPrice: 10,
  },
  edition: { grayChips: 50, violetMult: 10, rainbowFactor: 1.5 },
  editionRates: {
    joker: {
      base: { gray: 0.02, violet: 0.014, rainbow: 0.003, white: 0.003 },
      flyer: { gray: 0.04, violet: 0.028, rainbow: 0.009, white: 0.003 },
      wantedPoster: { gray: 0.08, violet: 0.056, rainbow: 0.021, white: 0.003 },
    },
    tile: {
      base: { gray: 0.04, violet: 0.028, rainbow: 0.012 },
      flyer: { gray: 0.08, violet: 0.056, rainbow: 0.024 },
      wantedPoster: { gray: 0.16, violet: 0.112, rainbow: 0.048 },
    },
    // Encyclopedia's Balatro-Illusion analog: fixed 20%, unaffected by Flyer.
    shopTile: { gray: 0.10, violet: 0.07, rainbow: 0.03 },
  },

  // ----- Packs (GDD §9.3) — 5 types × 3 sizes -----
  pack: {
    // size governs how many are shown / picked, and the price (Balatro 4/6/8).
    size: {
      normal: { show: 3, pick: 1, price: 4 },
      jumbo:  { show: 5, pick: 1, price: 6 },
      mega:   { show: 5, pick: 2, price: 8 },
    },
    // shop pack-slot roll weights (Mega/Jumbo rarer via sizeWeights below).
    // Display names (GDD §9.3): consumable=Fable, pattern=Constellation, tile=Tile,
    // joker=Charm, ink=Ink. Ink is the rare thrill (Spectral's role) and rolls
    // now that the Gambler registry ships (src/engine/gamblers.ts).
    typeWeights: { consumable: 4, pattern: 4, tile: 4, joker: 1.2, ink: 0.6 } as Record<string, number>,
    /** Comic Book only (GDD §9.3): per-choice chance a Fable Pack option becomes a
     *  Gambler card, capped at one per pack. Without the voucher it is exactly 0. */
    gamblerInFableChance: 0.05,
    /** Ink-only per-choice jackpot bands. */
    phoenixChance: 0.003,
    deerChance: 0.003,
    sizeWeights: { normal: 8, jumbo: 4, mega: 1 } as Record<string, number>,
    scarceShow: { normal: 2, jumbo: 4, mega: 4 } as Record<PackSize, number>,
    tileModifiers: { materialChance: 0.4, fontChance: 0.2 },
    // how many cosmetic art variants exist per (type, size) (== the art count in
    // packArt.ts); the seeded RNG picks one at stock time.
    artVariants: {
      tile: { normal: 4, jumbo: 2, mega: 2 },
      joker: { normal: 2, jumbo: 1, mega: 1 },
      pattern: { normal: 4, jumbo: 2, mega: 2 },
      consumable: { normal: 4, jumbo: 2, mega: 2 },
      ink: { normal: 2, jumbo: 1, mega: 1 },
    } as Record<PackType, Record<PackSize, number>>,
  },
  // ----- Emoji Tiles / Charm (GDD §9.2) — rarity offer weights. Legendary is
  //       omitted from ordinary rolls and appears only through jackpot routes. -----
  emoji: {
    rarityWeights: { common: 70, uncommon: 25, rare: 5 } as Record<string, number>,
    /** Profile achievement thresholds. A missing id is available from profile one. */
    unlockTargets: {
      miser: 25,
      fillInTheBlank: 10,
      bookworm: 100,
      alliterationSticker: 10,
      porcelainCat: 25,
      woodpecker: 50,
      proofEraser: 50,
      spareDrawer: 2,
      threeLeafClover: 10,
      megalith: 25,
      rareEarth: 4,
      glasswork: 3,
      voraciousReader: 100,
      comboArtist: 2,
      everydayHero: 300,
      slangDictionary: 100,
      oneVoice: 3,
      civilTongue: 3,
      sometimesY: 10,
      syllableScale: 10,
      glassInsurance: 25,
      growthRings: 60,
      materialSampler: 3,
      monomaterial: 5,
      scrapDealer: 20,
      lightTouch: 10,
      heavyPress: 10,
      hollowPromise: 5,
      doubleImpression: 10,
      houseStyle: 4,
      discardedDraft: 25,
      rewrite: 4,
      cleanCopy: 1,
      lastSort: 1,
      bestsellerBand: 5,
      badReview: 50,
      serial: 4,
      noiseCancelling: 5,
      stargazer: 50,
      carteBlanche: 3,
      hypocrite: 1,
      rhymeChain: 3,
      outOfPrint: 1,
      fableHoard: 50,
      anonymous: 4,
      censorsBane: 25,
      dadaist: 3,
      interestGlutton: 5,
      rotaryPress: 25,
      acrosticPoet: 1,
      alphabetPress: 3,
      consonantChoir: 4,
      stoneTongue: 150,
      woodblockPress: 100,
      materialPrism: 5,
      longFormSerial: 9,
      wordHunter: 500,
      plagiarist: 2,
      nightOwl: 1,
      livingType: 25,
      typesettingMachine: 20,
      royalWe: 10,
      brokenSentence: 1,
      copyEditor: 15,
      goldenType: 100,
      exactingCritic: 3,
      twentyFifthBlessing: 3,
      bloodTypeA: 10,
      handScholar: 8,
    } as Record<string, number>,
  },

  // ----- Jokers (GDD §11) — per-joker knobs. The 2026-08-02 ease pass buffs
  //       Common/Uncommon/Rare rewards by ~25% (integer rewards round up;
  //       multiplicative factors scale their amount above ×1). Legendary stays
  //       unchanged. Activation thresholds and costs remain stable unless the
  //       numeric utility is itself the reward. -----
  jokers: {
    // Common (§11.2)
    ceramicArtisan: { chips: 7 },
    longWordFan: { minLength: 5, chips: 80 },
    shortAndSharp: { maxLength: 3, mult: 10 },
    alphabeticalOrder: { mult: 15 },
    miser: { goldPer: 5, mult: 2 },
    alphabetSoup: { chipsPerDistinctLetter: 4 },
    redPencil: { chips: 23 },
    pocketDictionary: { mult: 7 },
    tongueTwister: { minLength: 6, mult: 10 },
    stenographer: { mult: 4 },
    fillInTheBlank: { chips: 80 },
    leftMargin: { chips: 50 },
    rightMargin: { mult: 5 },
    pageNumber: { mult: 8 },
    bookmark: { chips: 25 },
    tipJar: { gold: 2 },
    wastebasket: { gold: 2 },
    pouchTag: { tilesPerStep: 5, chipsPerStep: 5 },
    bookworm: { chipsPerWord: 20 },
    alliterationSticker: { mult: 7 },
    assonance: { repeatedVowels: 2, mult: 7 },
    porcelainCat: { mult: 9 },
    woodpecker: { chipsPerWood: 30 },
    threeLeafClover: { sellValuePerBlind: 3 },
    megalith: { stonesPerBlind: 1 },
    storyteller: { multPerFable: 1 },
    recycling: { goldPerTile: 5 },
    beehiveTile: { wordLength: 6, chipsPerWord: 6 },
    cubism: { baseFactor: 1, factorPerLeadPlate: 0.25 },
    // Uncommon (§11.3)
    literaryJudge: { chips: 69 },
    rareEarth: { factor: 3 }, // ×Chips on Q·Z·X·J tiles
    glasswork: { multPerGlass: 7 },
    voraciousReader: { chipsPerWord: 5 },
    classicist: { multPerFormal: 8 },
    streetCred: { chipsPerSlang: 30 },
    comboArtist: { mult: 8 },
    vowelMagnet: { factor: 1.75 },
    equilibrist: { chips: 50, mult: 5 },
    everydayHero: { minLength: 5, factor: 2 },
    formalInvitation: { gold: 3 },
    slangDictionary: { retriggers: 1 },
    oneVoice: { chips: 100 },
    civilTongue: { multPerBlind: 3 },
    uncensored: { chips: 100 },
    syllableScale: { difference: 1, chips: 100, mult: 5 },
    glassInsurance: { preventsPerBlind: 1 },
    growthRings: { chipsPerStep: 15, multPerStep: 4 },
    materialSampler: { chipsPerMaterial: 30 },
    monomaterial: { mult: 10 },
    strawberryJam: { factor: 3 },
    scrapDealer: { factorPerBrass: 0.2 },
    bald: { factor: 1.5 },
    shuriken: { baseFactor: 2, lossPerDiscardedTile: 0.01, minFactor: 0 },
    earthquake: { hands: 10 },
    dogFood: { multPerReroll: 2 },
    delisting: { gold: 3 },
    greatDepression: { goldPerStep: 1, goldPerStepHeld: 5 },
    leak: { baselineTiles: 68, multPerMissingTile: 4 },
    lightTouch: { goldPerTile: 2 },
    heavyPress: { chipsPerTile: 15 },
    hollowPromise: { gold: 3 },
    doubleImpression: { retriggers: 1 },
    houseStyle: { chips: 150 },
    discardedDraft: { chipsPerTile: 10 },
    rewrite: { multPerDiscard: 3 },
    cleanCopy: { minDiscardsLeft: 4, mult: 7 },
    fullDesk: { chipsPerHeldTile: 15 },
    clearDesk: { mult: 15 },
    lastSort: { chips: 300 },
    bagCounter: { tilesPerStep: 10, multPerStep: 3 },
    royaltyContract: { gold: 2 },
    bestsellerBand: { minLength: 7, gold: 3 },
    badReview: { gold: 3 },
    sentenceOpener: { chips: 50 },
    verbEngine: { mult: 8 },
    modifierStack: { chipsPerModifier: 15 },
    correctionMark: { mult: 13 },
    serial: { chipsPerMatch: 13 },
    noiseCancelling: { baseFactor: 1, factorPerSkippedBlind: 0.25 },
    host: { multPerSellValue: 2 },
    // Rare (§11.4)
    carteBlanche: { shopDiscount: 3 },
    hypocrite: { factor: 5 },
    rhymeChain: { factorPerMatch: 3 },
    outOfPrint: { chipsPerLetter: 50, multPerLetter: 8 },
    stargazer: { factorPerCard: 0.1 },
    fableHoard: { factorPerConsumable: 1.5 },
    anonymous: { factor: 3 },
    censorsBane: { factor: 3 },
    dadaist: { factor: 2.5 },
    interestGlutton: { multPerGold: 5 },
    acrosticPoet: { factor: 3.5 },
    alphabetPress: { factorPerPair: 1.25 },
    vowelChoir: { factorPerVowel: 1.25 },
    consonantChoir: { factorPerDuplicate: 1.5 },
    blackletterEngine: { retriggers: 1 },
    echoChamber: { retriggers: 1 },
    stoneTongue: { ignoredPerWord: 2 },
    glassCannon: { factorPerGlass: 1.5 },
    loadedLeadDice: { retriggers: 1 },
    woodblockPress: { factorPerGrowth: 0.1 },
    materialPrism: { factorPerMaterial: 1.25 },
    typeOrchestra: { factorPerFont: 1.25 },
    longFormSerial: { freeLetters: 5, factorPerLetter: 1.5 },
    handScholar: { factorPerNewHand: 0.5, maxFactor: 4 },
    wordHunter: { baseFactor: 2, factorPerNewWord: 0.1 },
    plagiarist: { factor: 4 },
    hotOffThePress: { minLength: 5, factor: 3.5 },
    nightOwl: { lowBag: 15, lowFactor: 3.5, emptyFactor: 6 },
    livingType: { chipsPerTile: 15 },
    typesettingMachine: { factorPerTile: 1.25 },
    royalWe: { factor: 3.5 },
    brokenSentence: { chips: 125, mult: 4 },
    holePunch: { factorPerGibberish: 0.2 },
    goldenType: { chips: 50 },
    deadlineAuction: { goldPerGrowth: 5, factorPerStep: 0.2 },
    termInsurance: { factor: 2 },
    exactingCritic: { factorPerUncommon: 2 },
    dullingPencil: { chips: 100, chipsLostPerHand: 5 },
    dryingInk: { mult: 15, multLostPerVowelWord: 1 },
    proofEraser: { discards: 1 },
    spareDrawer: { handSize: 1 },
    foldingManuscript: { handSize: 2, handSizeLostPerBlind: 1 },
    counterfeit: { copies: 1 },
    twentyFifthBlessing: { factorPerHeldY: 1.5 },
    bloodTypeA: { chipsPerLetter: 8 },
    dummyData: { length: 2 },
    blacksmith: { chipsPerEnhancement: 10 },
    gematria: { mult: 15 },
    cadmusTeeth: { chipsPerLetter: 10 },
    golem: { factor: 3 },
    temurah: { factor: 5 },
    alphabetPoet: { minWords: 3, factor: 3.5 },
    iotaStroke: { factor: 4 },
    zombie: {},
    biochemistry: { baseFactor: 1, factorPerChain: 0.5 },
    ambidextrous: { factor: 2 },
    thirdParty: { factor: 3 },
    mirrorImage: { factor: 3 },
    gathering: { factor: 2 },
    straightTalk: { factor: 3 },
    scarletLetter: { baseFactor: 1, factorPerDiscardedA: 0.1 },
    // Legendary (§11.5)
    bookOfMargins: { slots: 3, factorPerEmptySlot: 2 },
    tyrant: { vulgarFactor: 2 },
    typeFoundry: { factorPerTile: 1.5 },
    misbound: { destroyDenominator: 1_000, factorPerSurvival: 0.8 },
  },
  /** Q·Z·X·J — the Rare Earth (U3) letter set. */
  rareLetters: ['Q', 'Z', 'X', 'J'] as readonly Letter[],

  // ----- Gambler cards (GDD §10.3) — the Spectral analog -----
  gambler: {
    /** Bridge's floor. GDD §10.3 leaves the exact number a tuning decision; this
     *  is the first pass and the card is unusable once the hand reaches it. */
    bridgeHandSizeFloor: 5,
    butterfliesDestroy: 5,
    butterfliesGold: 20,
    curtainCopies: 2,
    fullMoonDestroy: 1,
    fullMoonVowels: 3,
    rainmanHandSizeLoss: 1,
  },

  // ----- Consumables (GDD §10) -----
  consumableSlots: 2,
  piggyBankCap: 20,
  fables: {
    cowherdEditionChance: 0.25,
    cowherdEditionWeights: { gray: 0.50, violet: 0.35, rainbow: 0.15 },
    crowWordHandStamps: 2,
    lionSkinEditionChance: 0.25,
    lionSkinEditionWeights: { gray: 0.50, violet: 0.35, rainbow: 0.15 },
  },

  // ----- Boss effects (GDD §8.3) — per-boss knobs -----
  boss: {
    wantedTargetMult: 2, // Wanted: XL blind, target ×2 (수배 전단)
    letterDiscardOnPlay: 4, // Unopened Letter: discard up to 4 random hand tiles per play (미개봉 편지)
    bondGoldPerPlay: 1, // Bond: −$1 per hand played (채권)
    historyBookPhaseReduction: 2, // History Book: −2 phases in this boss blind (역사책)
    budgetBookHandDelta: -3, // Budget Book: hand size −3 (가계부)
    willScale: 0.5, // Will: base chips & mult ×0.5 (유서)
    finisherReward: 8,
    vitalSignTargetMult: 3,
    cleaningSignGoldPerDiscardedTile: 2,
    medusaStoneTiles: 2,
  },
} as const;

export function packSizeRules(type: PackType, size: PackSize) {
  const base = BALANCE.pack.size[size];
  return {
    ...base,
    show: type === 'joker' || type === 'ink'
      ? BALANCE.pack.scarceShow[size]
      : base.show,
  };
}
