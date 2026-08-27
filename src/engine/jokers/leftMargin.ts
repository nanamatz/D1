import { BALANCE } from '../balance';
import { isScoringVowel, scoringLetter, type JokerDef } from '../events';

export const leftMargin: JokerDef = {
  id: 'leftMargin', gddNumber: 17, nameKo: '왼쪽 여백', nameEn: 'Left Margin',
  emoji: '📏', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (ctx.submission.tiles[0]?.id === tile.id && isScoringVowel(ctx, scoringLetter(ctx, tile))) {
        ctx.chips += BALANCE.jokers.leftMargin.chips;
      }
    },
  },
};
