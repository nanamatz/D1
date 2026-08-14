import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const shuriken: JokerDef = {
  id: 'shuriken', gddNumber: 57, nameKo: '수리검', nameEn: 'Shuriken',
  emoji: '🥷', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  initialState: () => ({ factor: BALANCE.jokers.shuriken.baseFactor }),
  growthDisplay: {
    kind: 'mult', stateKey: 'factor', initial: BALANCE.jokers.shuriken.baseFactor,
    showDecrease: true,
  },
  multOperation: 'multiply',
  hooks: {
    tilesDiscarded: ({ tiles }, self) => {
      self.state.factor = Math.max(
        BALANCE.jokers.shuriken.minFactor,
        (self.state.factor ?? BALANCE.jokers.shuriken.baseFactor) -
          tiles.length * BALANCE.jokers.shuriken.lossPerDiscardedTile,
      );
    },
    wordScoring: ({ ctx }, self) => {
      ctx.mult *= self.state.factor ?? BALANCE.jokers.shuriken.baseFactor;
    },
  },
};
