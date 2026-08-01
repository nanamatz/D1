import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** R6 (GDD §11.4) — ×1.25 Mult per consumable currently held. */
export const fableHoard: JokerDef = {
  id: 'fableHoard',
  gddNumber: 6,
  nameKo: '우화 수집',
  nameEn: 'Fable Hoard',
  emoji: '🗃️',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }) => {
      ctx.mult *= Math.pow(
        BALANCE.jokers.fableHoard.factorPerConsumable,
        run.consumables.length,
      );
    },
  },
};
