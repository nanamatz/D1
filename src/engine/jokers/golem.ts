import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const golem: JokerDef = {
  id: 'golem', gddNumber: 55, nameKo: '골렘', nameEn: 'Golem',
  emoji: '🗿', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.golem.factor,
  hooks: {
    wordScoring: ({ ctx, lookup }) => {
      if (ctx.submission.isGibberish || ctx.submission.text.length < 2) return;
      if (lookup?.(ctx.submission.text.slice(1))) ctx.mult *= BALANCE.jokers.golem.factor;
    },
  },
};
