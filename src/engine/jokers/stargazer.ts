import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const stargazer: JokerDef = {
  id: 'stargazer',
  gddNumber: 5,
  nameKo: '별자리 관측',
  nameEn: 'Stargazer',
  emoji: '🔭',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  hooks: {
    constellationUsed: (_payload, self) => {
      self.state.factor = (self.state.factor ?? 1) + BALANCE.jokers.stargazer.factorPerCard;
    },
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? 1;
    },
  },
};
