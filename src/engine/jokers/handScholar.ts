import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { evaluateLetterHand } from '../letterHands';
import { letterString } from '../scoring';

const factorFor = (count: number): number => Math.min(
  BALANCE.jokers.handScholar.maxFactor,
  1 + count * BALANCE.jokers.handScholar.factorPerNewHand,
);

const stateFromPlayedHands = (hands: readonly string[]): Record<string, number> => {
  const unique = new Set(hands);
  return {
    factor: factorFor(unique.size),
    ...Object.fromEntries([...unique].map((hand) => [`seen:${hand}`, 1])),
  };
};

const syncPlayedHands = (
  playedHands: readonly string[],
  state: Record<string, number>,
  currentHand?: string,
): number => {
  const unique = new Set(playedHands);
  for (const [key, value] of Object.entries(state)) {
    if (value > 0 && key.startsWith('seen:')) unique.add(key.slice('seen:'.length));
  }
  if (currentHand) unique.add(currentHand);
  for (const hand of unique) state[`seen:${hand}`] = 1;
  state.factor = factorFor(unique.size);
  return state.factor;
};

export const handScholar: JokerDef = {
  id: 'handScholar', gddNumber: 30, nameKo: '족보 학자', nameEn: 'Hand Scholar',
  emoji: '🎓', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  initialState: (run) => stateFromPlayedHands(run.playedLetterHands ?? []),
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      const hand = evaluateLetterHand(
        letterString(ctx.submission.tiles),
        ctx.submission.isGibberish,
        ctx.submission.scoringLength,
      );
      ctx.mult *= syncPlayedHands(run.playedLetterHands ?? [], self.state, hand?.id);
    },
  },
};
