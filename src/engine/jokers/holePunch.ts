import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const holePunch: JokerDef = {
  id: 'holePunch', gddNumber: 40, nameKo: '구멍 뚫기', nameEn: 'Hole Punch',
  emoji: '🕳️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }, self) => {
      if (ctx.submission.isGibberish) {
        self.state.factor = (self.state.factor ?? 1) + BALANCE.jokers.holePunch.factorPerGibberish;
      }
      ctx.mult *= self.state.factor ?? 1;
    },
  },
};
