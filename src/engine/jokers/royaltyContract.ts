import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const stateFromPlayedWords = (words: readonly string[]): Record<string, number> =>
  Object.fromEntries([...new Set(words.map((word) => word.toLowerCase()))]
    .map((word) => [`seen:${word}`, 1]));

export const royaltyContract: JokerDef = {
  id: 'royaltyContract', gddNumber: 35, nameKo: '인세 계약', nameEn: 'Royalty Contract',
  emoji: '📜', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  initialState: (run) => stateFromPlayedWords(run.playedWords ?? []),
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      if (ctx.submission.isGibberish) return;
      Object.assign(self.state, stateFromPlayedWords(run.playedWords ?? []));
      const key = `seen:${ctx.submission.text.toLowerCase()}`;
      if (self.state[key]) return;
      self.state[key] = 1;
      ctx.goldDelta = (ctx.goldDelta ?? 0) + BALANCE.jokers.royaltyContract.gold;
    },
  },
};
