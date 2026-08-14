import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const differsOnce = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let differences = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && ++differences > 1) return false;
  }
  return differences === 1;
};

export const iotaStroke: JokerDef = {
  id: 'iotaStroke', gddNumber: 58, nameKo: '이오타 획', nameEn: 'Iota Stroke',
  emoji: 'Ι', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.iotaStroke.factor,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence[blind.sequence.length - 1];
      if (ctx.submission.isGibberish || !previous || previous.isGibberish) return;
      if (differsOnce(ctx.submission.text.toUpperCase(), previous.text.toUpperCase())) {
        ctx.mult *= BALANCE.jokers.iotaStroke.factor;
      }
    },
  },
};
