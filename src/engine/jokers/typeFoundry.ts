import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const typeFoundry: JokerDef = {
  id: 'typeFoundry',
  gddNumber: 3,
  nameKo: '활자 주조소',
  nameEn: 'Type Foundry',
  emoji: '🔥',
  rarity: 'legendary',
  layer: 1,
  price: BALANCE.jokerPrice.legendary,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    tilesDestroyed: ({ count }, self) => {
      self.state.factor =
        (self.state.factor ?? 1) * Math.pow(BALANCE.jokers.typeFoundry.factorPerTile, count);
    },
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? 1;
    },
  },
};
