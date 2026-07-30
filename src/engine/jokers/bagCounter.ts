import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const bagCounter: JokerDef = {
  id: 'bagCounter', gddNumber: 34, nameKo: '자루 계수기', nameEn: 'Bag Counter',
  emoji: '🧮', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      ctx.mult += Math.floor(blind.bag.length / BALANCE.jokers.bagCounter.tilesPerStep)
        * BALANCE.jokers.bagCounter.multPerStep;
    },
  },
};
