import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionLength } from '../types';

export const stenographer: JokerDef = {
  id: 'stenographer', gddNumber: 15, nameKo: '속기사', nameEn: 'Stenographer',
  emoji: '⌨️', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence.at(-1);
      if (!ctx.submission.isGibberish && previous && !previous.isGibberish && !previous.debuffed &&
          submissionLength(previous) > submissionLength(ctx.submission)) {
        ctx.mult *= BALANCE.jokers.stenographer.factor;
      }
    },
  },
};
