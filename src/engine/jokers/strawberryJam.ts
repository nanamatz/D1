import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { submissionLetterString } from '../scoring';

const handOf = (submission: import('../types').WordSubmission) =>
  evaluateLetterHand(
    submissionLetterString(submission),
    submission.isGibberish,
    submission.scoringLength,
  )?.id;

export const strawberryJam: JokerDef = {
  id: 'strawberryJam', gddNumber: 55, nameKo: '딸기잼', nameEn: 'Strawberry Jam',
  emoji: '🍓', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.strawberryJam.factor,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const hand = handOf(ctx.submission);
      if (hand && blind.sequence.some((word) =>
        !word.isGibberish && !word.debuffed && handOf(word) === hand)) {
        ctx.mult *= BALANCE.jokers.strawberryJam.factor;
      }
    },
  },
};
