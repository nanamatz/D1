import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const wastebasket: JokerDef = {
  id: 'wastebasket', gddNumber: 22, nameKo: '휴지통', nameEn: 'Wastebasket',
  emoji: '🗑️', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  growthDisplay: {
    kind: 'gold', stateKey: 'paid', initial: 0, showInTooltip: false, playSound: false,
  },
  hooks: {
    discardUsed: ({ run }, self) => {
      if (self.state.paid) return;
      self.state.paid = BALANCE.jokers.wastebasket.gold;
      run.gold += BALANCE.jokers.wastebasket.gold;
    },
    blindEnd: (_payload, self) => { self.state.paid = 0; },
    blindCleanup: (_payload, self) => { self.state.paid = 0; },
  },
};
