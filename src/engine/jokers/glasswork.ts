import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** U4 (GDD §11.3) — +Mult per Glass tile in the played word. */
export const glasswork: JokerDef = {
  id: 'glasswork',
  gddNumber: 4,
  nameKo: '유리 세공',
  nameEn: 'Glasswork',
  emoji: '🪟',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.material === 'glass') ctx.mult += BALANCE.jokers.glasswork.multPerGlass;
    },
  },
};
