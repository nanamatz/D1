import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const rhymeChain: JokerDef = {
  id: 'rhymeChain',
  gddNumber: 3,
  nameKo: '각운 사슬',
  nameEn: 'Rhyme Chain',
  emoji: '🔗',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ blind, ctx }, self) => {
      const prior = blind.sequence.at(-1);
      const previous = prior?.text.toLowerCase();
      const current = ctx.submission.text.toLowerCase();
      const matched =
        !ctx.submission.isGibberish && !!prior && !prior.isGibberish && !prior.debuffed && !!previous &&
        previous.length >= 2 &&
        current.length >= 2 &&
        previous.slice(-2) === current.slice(-2);
      const factor = matched
        ? (self.state.factor ?? 1) * BALANCE.jokers.rhymeChain.factorPerMatch
        : 1;
      self.state.factor = factor;
      ctx.mult *= factor;
    },
    blindEnd: (_payload, self) => {
      self.state.factor = 1;
    },
  },
};
