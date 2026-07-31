import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const stenographer: JokerDef = {
  id: 'stenographer', gddNumber: 15, nameKo: '속기사', nameEn: 'Stenographer',
  emoji: '⌨️', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if ((blind.sequence.at(-1)?.tiles.length ?? 0) > ctx.submission.tiles.length) {
        ctx.mult += BALANCE.jokers.stenographer.mult;
      }
    },
  },
};
