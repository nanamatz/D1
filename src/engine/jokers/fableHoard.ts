import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** R6 (GDD §11.4) — ×1.5 Mult per consumable currently held. */
export const fableHoard: JokerDef = {
  scoresGibberish: true,
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
    wordScoring: ({ run, ctx, scoreBeats }) => {
      for (const _consumable of run.consumables) {
        ctx.mult *= BALANCE.jokers.fableHoard.factorPerConsumable;
        scoreBeats?.push({
          chipsDelta: 0,
          multDelta: 0,
          multFactor: BALANCE.jokers.fableHoard.factorPerConsumable,
        });
      }
    },
  },
};
