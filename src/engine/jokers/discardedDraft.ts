import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const discardedDraft: JokerDef = {
  scoresGibberish: true,
  id: 'discardedDraft', gddNumber: 28, nameKo: '버린 초고', nameEn: 'Discarded Draft',
  emoji: '🗞️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    tilesDiscarded: ({ tiles }, self) => {
      self.state.chips = (self.state.chips ?? 0)
        + tiles.length * BALANCE.jokers.discardedDraft.chipsPerTile;
    },
    wordScoring: ({ ctx }, self) => {
      ctx.chips += self.state.chips ?? 0;
    },
    blindEnd: (_payload, self) => { self.state.chips = 0; },
  },
};
