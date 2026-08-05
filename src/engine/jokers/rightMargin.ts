import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { isConsonant } from '../types';

export const rightMargin: JokerDef = {
  id: 'rightMargin', gddNumber: 18, nameKo: '오른쪽 여백', nameEn: 'Right Margin',
  emoji: '📐', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (ctx.submission.tiles.at(-1)?.id === tile.id && isConsonant(tile.letter)) {
        ctx.mult += BALANCE.jokers.rightMargin.mult;
      }
    },
  },
};
