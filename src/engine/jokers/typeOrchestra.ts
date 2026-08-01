import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const typeOrchestra: JokerDef = {
  id: 'typeOrchestra', gddNumber: 23, nameKo: '활자 오케스트라', nameEn: 'Type Orchestra',
  emoji: '🎻', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }) => {
      const count = new Set(ctx.submission.tiles.map((tile) => tile.font)).size;
      ctx.mult *= BALANCE.jokers.typeOrchestra.factorPerFont ** count;
    },
  },
};
