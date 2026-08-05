import { BALANCE } from '../balance';
import { isScoringVowel, type JokerDef } from '../events';

export const vowelChoir: JokerDef = {
  id: 'vowelChoir', gddNumber: 14, nameKo: '모음 합창단', nameEn: 'Vowel Choir',
  emoji: '🎶', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (isScoringVowel(ctx, tile.letter) &&
          ctx.submission.tiles.find((candidate) => candidate.letter === tile.letter)?.id === tile.id) {
        ctx.mult *= BALANCE.jokers.vowelChoir.factorPerVowel;
      }
    },
  },
};
