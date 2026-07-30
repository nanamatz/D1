import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const monomaterial: JokerDef = {
  id: 'monomaterial', gddNumber: 21, nameKo: '한 덩어리', nameEn: 'Monomaterial',
  emoji: '🧱', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      const first = ctx.submission.tiles[0]?.material;
      if (first && ctx.submission.tiles.every((tile) => tile.material === first)) {
        ctx.mult += BALANCE.jokers.monomaterial.mult;
      }
    },
  },
};
