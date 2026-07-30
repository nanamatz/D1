import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { isVerb } from '../types';

export const verbEngine: JokerDef = {
  id: 'verbEngine', gddNumber: 39, nameKo: '동사 엔진', nameEn: 'Verb Engine',
  emoji: '⚙️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (ctx.posTags?.some(isVerb)) ctx.mult += BALANCE.jokers.verbEngine.mult;
    },
  },
};
