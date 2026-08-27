import { BALANCE } from '../balance';
import { isScoringVowel, scoringLetter, type JokerDef } from '../events';

export const vowelChoir: JokerDef = {
  id: 'vowelChoir', gddNumber: 14, nameKo: '모음 합창단', nameEn: 'Vowel Choir',
  emoji: '🎶', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      const letter = scoringLetter(ctx, tile);
      if (isScoringVowel(ctx, letter) &&
          ctx.submission.tiles.find((candidate) => scoringLetter(ctx, candidate) === letter)?.id === tile.id) {
        ctx.mult *= BALANCE.jokers.vowelChoir.factorPerVowel;
      }
    },
  },
};
