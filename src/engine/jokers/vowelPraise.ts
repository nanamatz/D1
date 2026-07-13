/** #1 Vowel Praise (Common, layer 1): +2 Mult per vowel in the word.
 *  Layer 1 reads letters only, so it fires on gibberish too (GDD §6.4). */
import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { isVowel } from '../types';

export const vowelPraise: JokerDef = {
  id: 'vowelPraise',
  gddNumber: 1,
  nameKo: '모음 예찬',
  nameEn: 'Vowel Praise',
  emoji: '🅰️',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      const vowels = ctx.submission.tiles.filter((t) => isVowel(t.letter)).length;
      ctx.mult += BALANCE.jokers.vowelPraise.multPerVowel * vowels;
    },
  },
};
