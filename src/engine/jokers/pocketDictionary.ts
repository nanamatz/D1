import { BALANCE } from '../balance';
import { hasScoringSuit, type JokerDef } from '../events';

export const pocketDictionary: JokerDef = {
  id: 'pocketDictionary', gddNumber: 13, nameKo: '포켓 사전', nameEn: 'Pocket Dictionary',
  emoji: '📕', rarity: 'common', layer: 2, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (hasScoringSuit(ctx, 'standard')) ctx.mult += BALANCE.jokers.pocketDictionary.mult;
    },
  },
};
