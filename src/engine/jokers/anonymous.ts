import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { jokerSlotLimit } from '../vouchers';

/** R7 (GDD §11.4) — ×2.5 Mult while every EFFECTIVE Emoji Tile slot is full.
 *  `jokerSlotLimit` already folds in Kung Fu Manual, White editions,
 *  Carte Blanche (R1) and Book of Margins (L1) — the direct opposition to L1. */
export const anonymous: JokerDef = {
  id: 'anonymous',
  gddNumber: 7,
  nameKo: '무명의 저자',
  nameEn: 'Anonymous',
  emoji: '🕵️',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ run, ctx }) => {
      if (run.jokers.length >= jokerSlotLimit(run)) ctx.mult *= BALANCE.jokers.anonymous.factor;
    },
  },
};
