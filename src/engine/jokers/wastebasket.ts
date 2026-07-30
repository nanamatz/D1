import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const wastebasket: JokerDef = {
  id: 'wastebasket', gddNumber: 22, nameKo: '휴지통', nameEn: 'Wastebasket',
  emoji: '🗑️', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    discardUsed: ({ run }, self) => {
      if (self.state.paid) return;
      self.state.paid = 1;
      run.gold += BALANCE.jokers.wastebasket.gold;
    },
    blindEnd: (_payload, self) => { self.state.paid = 0; },
  },
};
