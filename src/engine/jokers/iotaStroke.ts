import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const iotaStroke: JokerDef = {
  id: 'iotaStroke', gddNumber: 58, nameKo: '이오타 획', nameEn: 'Iota Stroke',
  emoji: 'Ι', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.iotaStroke.factor,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (!ctx.submission.isGibberish && ctx.submission.tiles.some((tile) => tile.letter === 'I')) {
        ctx.mult *= BALANCE.jokers.iotaStroke.factor;
      }
    },
  },
};
