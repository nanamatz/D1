import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/**
 * L2 (GDD §11.5) — every valid word counts as Vulgar, and every Vulgar ×Mult is
 * doubled. Applied as an ADDITIVE delta from the word's own suit multiplier to
 * `suitMult.vulgar × 2`, so the result is independent of where Tyrant sits in
 * the shelf order. The submitted word and its visible register tag become Vulgar.
 */
export const tyrant: JokerDef = {
  id: 'tyrant',
  gddNumber: 2,
  nameKo: '폭군',
  nameEn: 'Tyrant',
  emoji: '👑',
  rarity: 'legendary',
  layer: 2,
  price: BALANCE.jokerPrice.legendary,
  multOperation: 'multiply',
  multDisplayFactor: BALANCE.jokers.tyrant.vulgarFactor,
  hooks: {
    wordRules: ({ ctx }) => {
      if (ctx.submission.isGibberish) return;
      ctx.submission.suit = 'vulgar';
      ctx.scoringSuits = new Set(['vulgar']);
    },
    wordScoring: ({ ctx }) => {
      const suit = ctx.baseSuit ?? ctx.submission.suit;
      if (suit === null) return; // gibberish is never a valid word (§6.4)
      const vulgar = BALANCE.suitMult.vulgar * BALANCE.jokers.tyrant.vulgarFactor;
      ctx.mult += vulgar - BALANCE.suitMult[suit];
    },
  },
};
