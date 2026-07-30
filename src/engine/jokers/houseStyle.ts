import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const houseStyle: JokerDef = {
  id: 'houseStyle', gddNumber: 27, nameKo: '하우스 스타일', nameEn: 'House Style',
  emoji: '📋', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      const first = ctx.submission.tiles[0]?.font;
      if (first && ctx.submission.tiles.every((tile) => tile.font === first)) {
        ctx.chips += BALANCE.jokers.houseStyle.chips;
      }
    },
  },
};
