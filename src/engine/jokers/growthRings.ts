import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const growthRings: JokerDef = {
  id: 'growthRings', gddNumber: 19, nameKo: '나이테', nameEn: 'Growth Rings',
  emoji: '🪵', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileScoring: ({ ctx, tile, scoreBeats }) => {
      if (tile.material === 'wood') {
        const steps = Math.floor(
          (tile.woodBonusChips ?? BALANCE.materials.wood.baseChips) /
          BALANCE.jokers.growthRings.chipsPerStep,
        );
        for (let step = 0; step < steps; step += 1) {
          ctx.mult += BALANCE.jokers.growthRings.multPerStep;
          scoreBeats?.push({
            chipsDelta: 0,
            multDelta: BALANCE.jokers.growthRings.multPerStep,
          });
        }
      }
    },
  },
};
