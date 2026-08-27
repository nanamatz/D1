import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const factorFor = (count: number) => BALANCE.jokers.scarletLetter.baseFactor +
  count * BALANCE.jokers.scarletLetter.factorPerDiscardedA;

export const scarletLetter: JokerDef = {
  scoresGibberish: true,
  id: 'scarletLetter', gddNumber: 30, nameKo: '주홍 글자', nameEn: 'The Scarlet Letter',
  emoji: 'A', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  initialState: (run) => ({ factor: factorFor(run.discardedLetterCounts?.A ?? 0) }),
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    tilesDiscarded: ({ tiles }, self) => {
      if (tiles[0]?.letter === 'A') {
        self.state.factor = (self.state.factor ?? BALANCE.jokers.scarletLetter.baseFactor)
          + BALANCE.jokers.scarletLetter.factorPerDiscardedA;
      }
    },
    wordScoring: ({ run, ctx }, self) => {
      self.state.factor = factorFor(run.discardedLetterCounts?.A ?? 0);
      ctx.mult *= self.state.factor;
    },
  },
};
