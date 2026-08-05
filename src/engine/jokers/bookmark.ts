import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionLength } from '../types';

export const bookmark: JokerDef = {
  id: 'bookmark', gddNumber: 20, nameKo: '책갈피', nameEn: 'Bookmark',
  emoji: '🔖', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.sequence.at(-1) &&
          submissionLength(blind.sequence.at(-1)!) === submissionLength(ctx.submission)) {
        ctx.chips += BALANCE.jokers.bookmark.chips;
      }
    },
  },
};
