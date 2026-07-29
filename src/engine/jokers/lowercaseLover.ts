import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** C5 (GDD §11.2) — flat Mult per lowercase tile, layer 1. */
export const lowercaseLover: JokerDef = {
  id: 'lowercaseLover',
  gddNumber: 5,
  nameKo: '소문자 애호가',
  nameEn: 'Lowercase Lover',
  emoji: '🔡',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.case === 'lower') ctx.mult += BALANCE.jokers.lowercaseLover.mult;
    },
  },
};
