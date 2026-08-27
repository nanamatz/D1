import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionLength } from '../types';

export const beehiveTile: JokerDef = {
  scoresGibberish: true,
  id: 'beehiveTile', gddNumber: 53, nameKo: '벌집 타일', nameEn: 'Beehive Tile',
  emoji: '🐝', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  initialState: () => ({ chips: BALANCE.jokers.beehiveTile.baseChips, base66: 1 }),
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: BALANCE.jokers.beehiveTile.baseChips },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      if (self.state.base66 !== 1) {
        self.state.chips = BALANCE.jokers.beehiveTile.baseChips + (self.state.chips ?? 0);
        self.state.base66 = 1;
      }
      if (!ctx.submission.isGibberish &&
          submissionLength(ctx.submission) === BALANCE.jokers.beehiveTile.wordLength) {
        self.state.chips = (self.state.chips ?? BALANCE.jokers.beehiveTile.baseChips) +
          BALANCE.jokers.beehiveTile.chipsPerWord;
      }
      ctx.chips += self.state.chips ?? BALANCE.jokers.beehiveTile.baseChips;
    },
  },
};
