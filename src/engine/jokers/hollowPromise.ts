import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const hollowPromise: JokerDef = {
  id: 'hollowPromise', gddNumber: 25, nameKo: '속 빈 약속', nameEn: 'Hollow Promise',
  emoji: '⭕', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    discardUsed: ({ run, slotsBlocked }) => {
      run.gold += slotsBlocked * BALANCE.jokers.hollowPromise.gold;
    },
  },
};
