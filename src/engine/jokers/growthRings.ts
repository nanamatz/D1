import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const growthRings: JokerDef = {
  id: 'growthRings', gddNumber: 19, nameKo: '나이테', nameEn: 'Growth Rings',
  emoji: '🪵', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      if (tile.material === 'wood') {
        ctx.mult += Math.floor(
          (tile.woodBonusChips ?? BALANCE.materials.wood.baseChips) /
          BALANCE.jokers.growthRings.chipsPerMult,
        );
      }
    },
  },
};
