import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const cubism: JokerDef = {
  scoresGibberish: true,
  id: 'cubism', gddNumber: 54, nameKo: '입체주의', nameEn: 'Cubism',
  emoji: '🧊', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  initialState: () => ({ factor: BALANCE.jokers.cubism.baseFactor }),
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: BALANCE.jokers.cubism.baseFactor },
  multOperation: 'multiply',
  hooks: {
    materialScored: ({ tile, triggerIndex, chanceResults = [] }, self) => {
      if (triggerIndex === 0 && tile.material === 'leadPlate' &&
          chanceResults.some((result) => result.outcome === 'success')) {
        self.state.factor = (self.state.factor ?? BALANCE.jokers.cubism.baseFactor) +
          BALANCE.jokers.cubism.factorPerLeadPlate;
      }
    },
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? BALANCE.jokers.cubism.baseFactor;
    },
  },
};
