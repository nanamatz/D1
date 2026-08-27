import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const misbound: JokerDef = {
  scoresGibberish: true,
  id: 'misbound',
  gddNumber: 5,
  nameKo: '파본',
  nameEn: 'Misbound',
  emoji: '📕',
  rarity: 'legendary',
  layer: 3,
  price: BALANCE.jokerPrice.legendary,
  initialState: () => ({ factor: 1, revision20260826: 1 }),
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? 1;
    },
    blindEnd: ({ rng, chanceResults }, self) => {
      const destroyed = rng.int(BALANCE.jokers.misbound.destroyDenominator) === 0;
      chanceResults.push({
        chance: 1 / BALANCE.jokers.misbound.destroyDenominator,
        label: 'destruction',
        outcome: destroyed ? 'destroyed' : 'survived',
        sourceId: self.defId,
        sourceEdition: self.edition ?? 'base',
      });
      if (destroyed) {
        self.state.destroyed = 1;
      } else {
        self.state.factor =
          (self.state.factor ?? 1) + BALANCE.jokers.misbound.factorPerSurvival;
      }
    },
  },
};
