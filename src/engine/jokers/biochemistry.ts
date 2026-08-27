import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand, LETTER_HAND_REGISTRY } from '../letterHands';
import { submissionLetterString } from '../scoring';
import type { WordSubmission } from '../types';

const handOf = (submission: WordSubmission) => evaluateLetterHand(
  submissionLetterString(submission),
  submission.isGibberish,
  submission.scoringLength,
)?.id;

export const biochemistry: JokerDef = {
  scoresGibberish: true,
  id: 'biochemistry', gddNumber: 60, nameKo: '생화학', nameEn: 'Biochemistry',
  emoji: '🧪', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  initialState: () => ({
    factor: BALANCE.jokers.biochemistry.baseFactor,
    revision20260826: 1,
  }),
  growthDisplay: {
    kind: 'mult', stateKey: 'factor', initial: BALANCE.jokers.biochemistry.baseFactor,
  },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      const current = handOf(ctx.submission);
      const counts = run.letterHandPlayCounts ?? {};
      const max = Math.max(0, ...LETTER_HAND_REGISTRY.map((hand) => counts[hand.id] ?? 0));
      if (current && max > 0 && (counts[current] ?? 0) === max) {
        self.state.factor = (self.state.factor ?? BALANCE.jokers.biochemistry.baseFactor) +
          BALANCE.jokers.biochemistry.factorPerHand;
      }
      ctx.mult *= self.state.factor ?? BALANCE.jokers.biochemistry.baseFactor;
    },
  },
};
