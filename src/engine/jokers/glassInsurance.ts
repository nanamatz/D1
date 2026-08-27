import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const glassInsurance: JokerDef = {
  id: 'glassInsurance', gddNumber: 18, nameKo: '유리 보험', nameEn: 'Glass Insurance',
  emoji: '🛡️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tileDestroying: (payload) => {
      if (payload.cause === 'glass') payload.cancelled = true;
    },
  },
};
