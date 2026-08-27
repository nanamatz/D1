import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const blacksmith: JokerDef = {
  scoresGibberish: true,
  id: 'blacksmith', gddNumber: 52, nameKo: '대장간', nameEn: 'Blacksmith',
  emoji: '⚒️', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    tilesEnhanced: ({ count }, self) => {
      self.state.chips = (self.state.chips ?? 0) +
        count * BALANCE.jokers.blacksmith.chipsPerEnhancement;
    },
    wordScoring: ({ ctx }, self) => { ctx.chips += self.state.chips ?? 0; },
  },
};
