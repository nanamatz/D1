import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const storyteller: JokerDef = {
  id: 'storyteller', gddNumber: 51, nameKo: '이야기꾼', nameEn: 'Storyteller',
  emoji: '📖', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ run, ctx }) => {
      ctx.mult += (run.fablesUsed ?? 0) * BALANCE.jokers.storyteller.multPerFable;
    },
  },
};
