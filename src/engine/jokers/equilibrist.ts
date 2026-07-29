import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { isConsonant, isVowel } from '../types';

/** U10 (GDD §11.3) — +Chips and +Mult when vowels and consonants are equal.
 *  Requires at least one of each, so an all-Stone word (0 = 0) pays nothing. */
export const equilibrist: JokerDef = {
  id: 'equilibrist',
  gddNumber: 10,
  nameKo: '균형 곡예사',
  nameEn: 'Equilibrist',
  emoji: '🤹',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      const tiles = ctx.submission.tiles;
      const vowels = tiles.filter((tile) => isVowel(tile.letter)).length;
      const consonants = tiles.filter((tile) => isConsonant(tile.letter)).length;
      if (vowels === 0 || vowels !== consonants) return;
      ctx.chips += BALANCE.jokers.equilibrist.chips;
      ctx.mult += BALANCE.jokers.equilibrist.mult;
    },
  },
};
