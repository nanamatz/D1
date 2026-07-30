import { BALANCE } from '../balance';
import { isScoringVowel, type JokerDef } from '../events';

export const leftMargin: JokerDef = {
  id: 'leftMargin', gddNumber: 17, nameKo: '왼쪽 여백', nameEn: 'Left Margin',
  emoji: '📏', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (isScoringVowel(ctx, ctx.submission.tiles[0]?.letter ?? null)) {
        ctx.chips += BALANCE.jokers.leftMargin.chips;
      }
    },
  },
};
