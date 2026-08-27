import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const typeOrchestra: JokerDef = {
  id: 'typeOrchestra', gddNumber: 23, nameKo: '활자 오케스트라', nameEn: 'Type Orchestra',
  emoji: '🎻', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      const fonts = new Set(ctx.submission.tiles.map((candidate) => candidate.font));
      if (fonts.size >= 2 &&
        ctx.submission.tiles.find((candidate) => candidate.font === tile.font)?.id === tile.id) {
        ctx.mult *= BALANCE.jokers.typeOrchestra.factorPerFont;
      }
    },
  },
};
