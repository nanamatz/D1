import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const woodblockPress: JokerDef = {
  id: 'woodblockPress', gddNumber: 21, nameKo: '목판 인쇄', nameEn: 'Woodblock Press',
  emoji: '🪵', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  hooks: {
    materialScored: ({ grewWood }, self) => {
      if (grewWood) self.state.factor = (self.state.factor ?? 1) +
        BALANCE.jokers.woodblockPress.factorPerGrowth;
    },
    wordScoring: ({ ctx }, self) => { ctx.mult *= self.state.factor ?? 1; },
  },
};
