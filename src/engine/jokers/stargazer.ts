import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const stargazer: JokerDef = {
  id: 'stargazer',
  gddNumber: 5,
  nameKo: '천문학자',
  nameEn: 'Astronomer',
  emoji: '🔭',
  rarity: 'uncommon',
  layer: 3,
  price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    constellationUsed: (_payload, self) => {
      self.state.factor = (self.state.factor ?? 1) + BALANCE.jokers.stargazer.factorPerCard;
    },
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? 1;
    },
  },
};
