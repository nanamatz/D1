import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** C10 (GDD §11.2) — +Mult scaled by gold currently held, layer 1. */
export const miser: JokerDef = {
  id: 'miser',
  gddNumber: 10,
  nameKo: '구두쇠',
  nameEn: 'Miser',
  emoji: '🪙',
  rarity: 'common',
  layer: 1,
  price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ run, ctx }) => {
      const { goldPer, mult } = BALANCE.jokers.miser;
      ctx.mult += Math.floor(Math.max(0, run.gold) / goldPer) * mult;
    },
  },
};
