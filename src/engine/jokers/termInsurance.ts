import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const termInsurance: JokerDef = {
  initialState: () => ({
    factor: BALANCE.jokers.termInsurance.baseFactor,
    revision20260826: 1,
  }),
  scoresGibberish: true,
  id: 'termInsurance', gddNumber: 44, nameKo: '단기 보험', nameEn: 'Term Insurance',
  emoji: '🛡️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  growthDisplay: {
    kind: 'mult', stateKey: 'factor', initial: BALANCE.jokers.termInsurance.baseFactor,
  },
  hooks: {
    tilesDestroyed: (_payload, self) => {
      self.state.factor = (self.state.factor ?? BALANCE.jokers.termInsurance.baseFactor) +
        BALANCE.jokers.termInsurance.factorPerTile;
    },
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? BALANCE.jokers.termInsurance.baseFactor;
    },
  },
};
