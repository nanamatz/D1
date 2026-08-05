import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionLength } from '../types';

export const stenographer: JokerDef = {
  id: 'stenographer', gddNumber: 15, nameKo: '속기사', nameEn: 'Stenographer',
  emoji: '⌨️', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.sequence.at(-1) &&
          submissionLength(blind.sequence.at(-1)!) > submissionLength(ctx.submission)) {
        ctx.mult += BALANCE.jokers.stenographer.mult;
      }
    },
  },
};
