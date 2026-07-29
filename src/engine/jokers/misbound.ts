import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const misbound: JokerDef = {
  id: 'misbound',
  gddNumber: 5,
  nameKo: '파본',
  nameEn: 'Misbound',
  emoji: '📕',
  rarity: 'legendary',
  layer: 3,
  price: BALANCE.jokerPrice.legendary,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? 1;
    },
    blindEnd: ({ rng }, self) => {
      if (rng.int(BALANCE.jokers.misbound.destroyDenominator) === 0) {
        self.state.destroyed = 1;
      } else {
        self.state.factor =
          (self.state.factor ?? 1) + BALANCE.jokers.misbound.factorPerSurvival;
      }
    },
  },
};
