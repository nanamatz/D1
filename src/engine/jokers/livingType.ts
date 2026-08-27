import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const livingType: JokerDef = {
  scoresGibberish: true,
  id: 'livingType', gddNumber: 35, nameKo: '살아 있는 활자', nameEn: 'Living Type',
  emoji: '🦵', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    tilesCreated: ({ count }, self) => {
      self.state.chips = (self.state.chips ?? 0) + count * BALANCE.jokers.livingType.chipsPerTile;
    },
    wordScoring: ({ ctx }, self) => { ctx.chips += self.state.chips ?? 0; },
  },
};
