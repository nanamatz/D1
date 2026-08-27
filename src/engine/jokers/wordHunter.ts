import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const stateFromPlayedWords = (words: readonly string[]): Record<string, number> => {
  const unique = new Set(words.map((word) => word.toLowerCase()));
  return {
    factor: BALANCE.jokers.wordHunter.baseFactor
      + unique.size * BALANCE.jokers.wordHunter.factorPerNewWord,
    ...Object.fromEntries([...unique].map((word) => [`seen:${word}`, 1])),
  };
};

export const wordHunter: JokerDef = {
  scoresGibberish: true,
  id: 'wordHunter', gddNumber: 31, nameKo: '단어 사냥꾼', nameEn: 'Word Hunter',
  emoji: '🦋', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  initialState: (run) => stateFromPlayedWords(run.playedWords ?? []),
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: BALANCE.jokers.wordHunter.baseFactor },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      const history = stateFromPlayedWords(run.playedWords ?? []);
      for (const [key, value] of Object.entries(history)) {
        if (key !== 'factor') self.state[key] = value;
      }
      self.state.factor = history.factor ?? BALANCE.jokers.wordHunter.baseFactor;
      const word = ctx.submission.text.toLowerCase();
      if (!ctx.submission.isGibberish && !self.state[`seen:${word}`]) {
        self.state[`seen:${word}`] = 1;
        self.state.factor = (self.state.factor ?? BALANCE.jokers.wordHunter.baseFactor)
          + BALANCE.jokers.wordHunter.factorPerNewWord;
      }
      ctx.mult *= self.state.factor ?? BALANCE.jokers.wordHunter.baseFactor;
    },
  },
};
