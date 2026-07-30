import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const plagiarist: JokerDef = {
  id: 'plagiarist', gddNumber: 32, nameKo: '표절가', nameEn: 'Plagiarist',
  emoji: '📋', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence.at(-1);
      if (!ctx.submission.isGibberish && previous && !previous.isGibberish &&
          previous.text === ctx.submission.text) ctx.mult *= BALANCE.jokers.plagiarist.factor;
    },
  },
};
