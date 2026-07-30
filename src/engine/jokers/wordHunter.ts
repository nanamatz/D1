import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const wordHunter: JokerDef = {
  id: 'wordHunter', gddNumber: 31, nameKo: '단어 사냥꾼', nameEn: 'Word Hunter',
  emoji: '🦋', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      if (!ctx.submission.isGibberish && !self.state[`seen:${ctx.submission.text}`]) {
        self.state[`seen:${ctx.submission.text}`] = 1;
        self.state.factor = (self.state.factor ?? 1) + BALANCE.jokers.wordHunter.factorPerNewWord;
      }
      ctx.mult *= self.state.factor ?? 1;
    },
  },
};
