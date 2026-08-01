import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { letterString } from '../scoring';

export const handScholar: JokerDef = {
  id: 'handScholar', gddNumber: 30, nameKo: '족보 학자', nameEn: 'Hand Scholar',
  emoji: '🎓', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ ctx }, self) => {
      const hand = evaluateLetterHand(letterString(ctx.submission.tiles), ctx.submission.isGibberish);
      if (hand && !self.state[`seen:${hand.id}`]) {
        self.state[`seen:${hand.id}`] = 1;
        self.state.factor = (self.state.factor ?? 1) + BALANCE.jokers.handScholar.factorPerNewHand;
      }
      ctx.mult *= self.state.factor ?? 1;
    },
  },
};
