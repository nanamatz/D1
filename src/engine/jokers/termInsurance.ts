import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const termInsurance: JokerDef = {
  id: 'termInsurance', gddNumber: 44, nameKo: '단기 보험', nameEn: 'Term Insurance',
  emoji: '🛡️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    tileDestroying: (payload, self) => {
      if (self.state.destroyed === 1) return;
      payload.cancelled = true;
      self.state.prevented = (self.state.prevented ?? 0) + 1;
      payload.ctx.chips += BALANCE.jokers.termInsurance.chipsPerPrevent;
      if (self.state.prevented >= BALANCE.jokers.termInsurance.prevents) self.state.destroyed = 1;
    },
  },
};
