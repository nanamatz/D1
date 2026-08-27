import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const nightOwl: JokerDef = {
  scoresGibberish: true,
  id: 'nightOwl', gddNumber: 34, nameKo: '야행성 작가', nameEn: 'Night Owl',
  emoji: '🦉', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (blind.bag.length === 0) ctx.mult *= BALANCE.jokers.nightOwl.emptyFactor;
      else if (blind.bag.length <= BALANCE.jokers.nightOwl.lowBag) {
        ctx.mult *= BALANCE.jokers.nightOwl.lowFactor;
      }
    },
  },
};
