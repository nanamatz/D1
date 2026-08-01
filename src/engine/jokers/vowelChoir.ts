import { BALANCE } from '../balance';
import { isScoringVowel, type JokerDef } from '../events';

export const vowelChoir: JokerDef = {
  id: 'vowelChoir', gddNumber: 14, nameKo: '모음 합창단', nameEn: 'Vowel Choir',
  emoji: '🎶', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      const vowels = new Set(ctx.submission.tiles.flatMap((tile) =>
        isScoringVowel(ctx, tile.letter) ? [tile.letter!] : []));
      ctx.mult *= BALANCE.jokers.vowelChoir.factorPerVowel ** vowels.size;
    },
  },
};
