import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const hotOffThePress: JokerDef = {
  id: 'hotOffThePress', gddNumber: 33, nameKo: '따끈따끈', nameEn: 'Hot off the Press',
  emoji: '♨️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.sequence.length === 0 &&
          ctx.submission.tiles.length >= BALANCE.jokers.hotOffThePress.minLength) {
        ctx.mult *= BALANCE.jokers.hotOffThePress.factor;
      }
    },
  },
};
