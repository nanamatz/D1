import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const serial: JokerDef = {
  id: 'serial', gddNumber: 42, nameKo: '연재물', nameEn: 'Serial',
  emoji: '📰', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    wordScoring: ({ blind, ctx }, self) => {
      const previous = blind.sequence.at(-1);
      if (
        previous &&
        !previous.isGibberish &&
        !ctx.submission.isGibberish &&
        previous.tiles.length === ctx.submission.tiles.length
      ) self.state.chips = (self.state.chips ?? 0) + BALANCE.jokers.serial.chipsPerMatch;
      ctx.chips += self.state.chips ?? 0;
    },
    blindEnd: (_payload, self) => { self.state.chips = 0; },
  },
};
