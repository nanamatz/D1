import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const cleanCopy: JokerDef = {
  id: 'cleanCopy', gddNumber: 30, nameKo: '깨끗한 원고', nameEn: 'Clean Copy',
  emoji: '📄', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }, self) => {
      if (!self.state.discarded) ctx.mult += BALANCE.jokers.cleanCopy.mult;
    },
    discardUsed: (_payload, self) => { self.state.discarded = 1; },
    blindEnd: (_payload, self) => { self.state.discarded = 0; },
  },
};
