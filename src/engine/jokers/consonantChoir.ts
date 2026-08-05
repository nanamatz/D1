import { BALANCE } from '../balance';
import { isScoringVowel, type JokerDef } from '../events';

export const consonantChoir: JokerDef = {
  id: 'consonantChoir', gddNumber: 15, nameKo: '자음 합창단', nameEn: 'Consonant Choir',
  emoji: '🎼', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      const index = ctx.submission.tiles.findIndex((candidate) => candidate.id === tile.id);
      if (tile.letter !== null && !isScoringVowel(ctx, tile.letter) &&
          ctx.submission.tiles.slice(0, index).some((candidate) => candidate.letter === tile.letter)) {
        ctx.mult *= BALANCE.jokers.consonantChoir.factorPerDuplicate;
      }
    },
  },
};
