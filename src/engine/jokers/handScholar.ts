import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { letterString } from '../scoring';

const stateFromPlayedHands = (hands: readonly string[]): Record<string, number> => {
  const unique = new Set(hands);
  return {
    factor: 1 + unique.size * BALANCE.jokers.handScholar.factorPerNewHand,
    ...Object.fromEntries([...unique].map((hand) => [`seen:${hand}`, 1])),
  };
};

export const handScholar: JokerDef = {
  id: 'handScholar', gddNumber: 30, nameKo: '족보 학자', nameEn: 'Hand Scholar',
  emoji: '🎓', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  initialState: (run) => stateFromPlayedHands(run.playedLetterHands ?? []),
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      const history = stateFromPlayedHands(run.playedLetterHands ?? []);
      for (const [key, value] of Object.entries(history)) {
        if (key !== 'factor') self.state[key] = value;
      }
      self.state.factor = Math.max(self.state.factor ?? 1, history.factor ?? 1);
      const hand = evaluateLetterHand(letterString(ctx.submission.tiles), ctx.submission.isGibberish);
      if (hand && !self.state[`seen:${hand.id}`]) {
        self.state[`seen:${hand.id}`] = 1;
        self.state.factor = (self.state.factor ?? 1) + BALANCE.jokers.handScholar.factorPerNewHand;
      }
      ctx.mult *= self.state.factor ?? 1;
    },
  },
};
