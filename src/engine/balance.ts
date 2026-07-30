/**
 * BALANCE — every tunable number in the game, in one place.
 *
 * Rule: no magic numbers anywhere in src/engine. If a value appears in a
 * GDD table marked "placeholder", it lives here. The headless simulator
 * (src/sim) sweeps these values; playtesting overwrites them.
 * GDD section references are noted per block.
 */

import type { FontEffectId, Letter, PackSize, PackType, TileFont } from './types';

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
    objectComplement: { rank: 9, baseChips: 75, baseMult: 5, levelChips: 35, levelMult: 2 },
    interrogative:    { rank: 10, baseChips: 90, baseMult: 5, levelChips: 40, levelMult: 2 },
    negative:         { rank: 11, baseChips: 110, baseMult: 6, levelChips: 45, levelMult: 2.5 },
    complex:          { rank: 12, baseChips: 130, baseMult: 6, levelChips: 50, levelMult: 2.5 },
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
  shop: {
    itemSlots: 2,
    packSlots: 2,
    rerollBase: 5,
    rerollIncrement: 1,
    itemWeights: { joker: 80, tile: 10, consumable: 5, punctuation: 5 },
  },
  jokerPrice: { common: 5, uncommon: 7, rare: 9, legendary: 20 },
  jokerSlots: 5,
  consumablePrice: 3, // flat consumable price (placeholder, GDD §9.2)
  tilePrice: 3,

  // ----- Vouchers (GDD §9.4) — 16 base + 16 unlocked upgrades -----
  voucherPrice: 10,
  voucher: {
    rerollDiscount: 2,
    baseInterestCap: 10,
    upgradedInterestCap: 20,
    baseShopDiscount: 0.25,
    upgradedShopDiscount: 0.5,
    bossRerollPrice: 10,
    editionChance: 0.08,
  },
  edition: { foilChips: 50, holographicMult: 10, polychromeFactor: 1.5 },

  // ----- Packs (GDD §9.3) — 4 types × 3 sizes -----
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
    typeWeights: { consumable: 4, pattern: 4, tile: 4, joker: 2, ink: 0.6 } as Record<string, number>,
    /** Comic Book only (GDD §9.3): per-choice chance a Fable Pack option becomes a
     *  Gambler card, capped at one per pack. Without the voucher it is exactly 0. */
    gamblerInFableChance: 0.05,
    /** Deer's cross-family exception: chance one Constellation-Pack choice becomes
     *  Deer, capped at one per pack (GDD §9.3, §10.3 #9). */
    deerInConstellationChance: 0.01,
    sizeWeights: { normal: 8, jumbo: 3, mega: 1 } as Record<string, number>,
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
  packEnhanceChance: { base: 0.15 }, // material/font pre-attach rate

  // ----- Emoji Tiles / Charm (GDD §9.2) — rarity offer weights. Legendary is
  //       OMITTED on purpose: it has no acquisition route yet (§12 open), so an
  //       absent weight (→ 0) means it NEVER rolls in the shop or a Charm Pack,
  //       rather than silently appearing. Adding a route = add its weight here. -----
  emoji: {
    rarityWeights: { common: 70, uncommon: 25, rare: 5 } as Record<string, number>,
  },

  // ----- Jokers (GDD §11) — per-joker knobs -----
  jokers: {
    loanShark: { goldPerPhase: 1 }, // #28 (not yet implemented) — $ per phase left at clear
    // Common (§11.2)
    ceramicArtisan: { chips: 5 },
    longWordFan: { minLength: 5, chips: 30 },
    shortAndSharp: { maxLength: 3, mult: 8 },
    alphabeticalOrder: { mult: 15 },
    miser: { goldPer: 5, mult: 1 },
    alphabetSoup: { chipsPerDistinctLetter: 3 },
    redPencil: { chips: 18 },
    pocketDictionary: { mult: 5 },
    tongueTwister: { minLength: 6, mult: 8 },
    stenographer: { multPerRepeatedLetter: 3 },
    fillInTheBlank: { chips: 25 },
    leftMargin: { chips: 15 },
    rightMargin: { mult: 4 },
    pageNumber: { mult: 6 },
    bookmark: { chips: 20 },
    tipJar: { gold: 1 },
    wastebasket: { gold: 1 },
    pouchTag: { tilesPerStep: 5, chipsPerStep: 4 },
    bookworm: { chipsPerWord: 5 },
    alliterationSticker: { mult: 5 },
    assonance: { repeatedVowels: 2, mult: 5 },
    porcelainCat: { mult: 7 },
    woodpecker: { chipsPerWood: 8 },
    letterLadderBadge: { chips: 45 },
    // Uncommon (§11.3)
    literaryJudge: { chips: 50 },
    rareEarth: { factor: 3 }, // ×Chips on Q·Z·X·J tiles
    glasswork: { multPerGlass: 5, lostPerBlind: 1 },
    voraciousReader: { chipsPerWord: 1 },
    classicist: { multPerFormal: 1 },
    streetCred: { chipsPerSlang: 8 },
    comboArtist: { mult: 6 },
    vowelMagnet: { factor: 1.5 },
    equilibrist: { chips: 40, mult: 4 },
    everydayHero: { minLength: 5, factor: 1.5 },
    formalInvitation: { gold: 2 },
    slangDictionary: { retriggers: 1 },
    oneVoice: { chips: 60 },
    civilTongue: { multPerBlind: 2 },
    uncensored: { chips: 80 },
    syllableScale: { difference: 1, chips: 35, mult: 4 },
    glassInsurance: { preventsPerBlind: 1 },
    growthRings: { chipsPerMult: 20 },
    materialSampler: { chipsPerMaterial: 15 },
    monomaterial: { mult: 8 },
    scrapDealer: { goldPerTile: 3 },
    lightTouch: { goldPerTile: 1 },
    heavyPress: { chipsPerTile: 15 },
    hollowPromise: { gold: 2 },
    doubleImpression: { retriggers: 1 },
    houseStyle: { chips: 50 },
    discardedDraft: { chipsPerTile: 3 },
    rewrite: { multPerDiscard: 2 },
    cleanCopy: { mult: 5 },
    fullDesk: { chipsPerHeldTile: 5 },
    clearDesk: { mult: 12 },
    lastSort: { chips: 80 },
    bagCounter: { tilesPerStep: 10, multPerStep: 2 },
    royaltyContract: { gold: 1 },
    bestsellerBand: { minLength: 7, gold: 2 },
    badReview: { gold: 2, multPenalty: 1, minMult: 1 },
    sentenceOpener: { chips: 40 },
    verbEngine: { mult: 6 },
    modifierStack: { chipsPerModifier: 12 },
    correctionMark: { mult: 10 },
    serial: { chipsPerMatch: 10 },
    // Rare (§11.4)
    carteBlanche: { slots: 1, shopDiscount: 2 },
    hypocrite: { factor: 2 },
    rhymeChain: { factorPerMatch: 1.5 },
    outOfPrint: { chipsPerLetter: 25, multPerLetter: 3 },
    stargazer: { factorPerCard: 0.15 },
    fableHoard: { factorPerConsumable: 1.25 },
    anonymous: { factor: 2.5 },
    censorsBane: { factor: 2.5 },
    dadaist: { factor: 2 },
    interestGlutton: { multPerGold: 2 },
    acrosticPoet: { factor: 3 },
    alphabetPress: { factorPerPair: 1.25 },
    vowelChoir: { factorPerVowel: 1.2 },
    consonantChoir: { factorPerDuplicate: 1.35 },
    blackletterEngine: { retriggers: 1 },
    echoChamber: { retriggers: 1 },
    stoneTongue: { ignoredPerWord: 1 },
    glassCannon: { factorPerGlass: 1.25 },
    loadedLeadDice: { retriggers: 1 },
    woodblockPress: { factorPerGrowth: 0.05 },
    materialPrism: { factorPerMaterial: 1.25 },
    typeOrchestra: { factorPerFont: 1.3 },
    palindromist: { factor: 4 },
    straightShooter: { factor: 3 },
    vowelSymphony: { factor: 3 },
    longFormSerial: { freeLetters: 5, factorPerLetter: 1.25 },
    twinPeaks: { retriggers: 1 },
    threefoldSeal: { retriggers: 1 },
    handScholar: { factorPerNewHand: 0.2 },
    wordHunter: { factorPerNewWord: 0.03 },
    plagiarist: { factor: 4 },
    hotOffThePress: { minLength: 5, factor: 3 },
    nightOwl: { lowBag: 15, lowFactor: 3, emptyFactor: 5 },
    livingType: { chipsPerTile: 10 },
    typesettingMachine: { factorPerTile: 1.2 },
    synesthete: { factorPerCombo: 1.15 },
    royalWe: { factor: 3 },
    brokenSentence: { chips: 100, mult: 3 },
    holePunch: { factorPerGibberish: 0.15 },
    goldenType: { chips: 40 },
    deadlineAuction: { goldPerGrowth: 5, factorPerStep: 0.1 },
    termInsurance: { prevents: 3, chipsPerPrevent: 50 },
    exactingCritic: { factorPerRareLeft: 1.5 },
    // Legendary (§11.5)
    bookOfMargins: { slots: 3, factorPerEmptySlot: 2 },
    tyrant: { vulgarFactor: 2 },
    typeFoundry: { factorPerTile: 1.5 },
    misbound: { destroyDenominator: 12, factorPerSurvival: 0.2 },
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
  },

  // ----- Consumables (GDD §10) -----
  consumableSlots: 2,
  piggyBankCap: 20,

  // ----- Boss effects (GDD §8.3) — per-boss knobs -----
  boss: {
    wantedTargetMult: 2, // Wanted: XL blind, target ×2 (수배 전단)
    letterDiscardOnPlay: 4, // Unopened Letter: discard up to 4 random hand tiles per play (미개봉 편지)
    bondGoldPerTile: 1, // Bond: −$1 per tile played (채권)
    historyBookPhaseReduction: 2, // History Book: −2 phases in this boss blind (역사책)
    budgetBookHandDelta: -3, // Budget Book: hand size −3 (가계부)
    willScale: 0.5, // Will: base chips & mult ×0.5 (유서)
  },
} as const;
