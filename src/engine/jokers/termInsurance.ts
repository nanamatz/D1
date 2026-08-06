import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const termInsurance: JokerDef = {
  id: 'termInsurance', gddNumber: 44, nameKo: '단기 보험', nameEn: 'Term Insurance',
  emoji: '🛡️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  multDisplayFactor: BALANCE.jokers.termInsurance.factor,
  hooks: {
    tileDestroying: (payload) => {
      payload.cancelled = true;
      payload.ctx.mult *= BALANCE.jokers.termInsurance.factor;
    },
  },
};
