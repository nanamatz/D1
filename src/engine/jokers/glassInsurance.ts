import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const glassInsurance: JokerDef = {
  id: 'glassInsurance', gddNumber: 18, nameKo: '유리 보험', nameEn: 'Glass Insurance',
  emoji: '🛡️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileDestroying: (payload, self) => {
      if (payload.cause !== 'glass' || (self.state.prevented ?? 0) >= BALANCE.jokers.glassInsurance.preventsPerBlind) return;
      payload.cancelled = true;
      self.state.prevented = (self.state.prevented ?? 0) + 1;
    },
    blindEnd: (_payload, self) => { self.state.prevented = 0; },
  },
};
