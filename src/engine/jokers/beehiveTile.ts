import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionLength } from '../types';

export const beehiveTile: JokerDef = {
  id: 'beehiveTile', gddNumber: 53, nameKo: '벌집 타일', nameEn: 'Beehive Tile',
  emoji: '🐝', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  initialState: () => ({ chips: 0 }),
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      if (submissionLength(ctx.submission) === BALANCE.jokers.beehiveTile.wordLength) {
        self.state.chips = (self.state.chips ?? 0) + BALANCE.jokers.beehiveTile.chipsPerWord;
      }
      ctx.chips += self.state.chips ?? 0;
    },
  },
};
