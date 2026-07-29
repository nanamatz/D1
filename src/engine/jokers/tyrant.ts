import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/**
 * L2 (GDD §11.5) — every valid word counts as Vulgar, and every Vulgar ×Mult is
 * doubled. Applied as an ADDITIVE delta from the word's own suit multiplier to
 * `suitMult.vulgar × 2`, so the result is independent of where Tyrant sits in
 * the shelf order. The canonical `submission.suit` is untouched: bosses, Unison,
 * and sentence history keep reading the real register (§11.7).
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
  hooks: {
    wordRules: ({ ctx }) => {
      if (!ctx.submission.isGibberish) ctx.scoringSuits?.add('vulgar');
    },
    wordScoring: ({ ctx }) => {
      const suit = ctx.submission.suit;
      if (suit === null) return; // gibberish is never a valid word (§6.4)
      const vulgar = BALANCE.suitMult.vulgar * BALANCE.jokers.tyrant.vulgarFactor;
      ctx.mult += vulgar - BALANCE.suitMult[suit];
    },
  },
};
