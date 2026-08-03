import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const dullingPencil: JokerDef = {
  id: 'dullingPencil', gddNumber: 30, nameKo: '닳는 연필', nameEn: 'Dulling Pencil',
  emoji: '✏️', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: BALANCE.jokers.dullingPencil.chips },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      const current = self.state.chips ?? BALANCE.jokers.dullingPencil.chips;
      ctx.chips += current;
      self.state.chips = Math.max(
        0,
        current - BALANCE.jokers.dullingPencil.chipsLostPerHand,
      );
      if (self.state.chips === 0) self.state.destroyed = 1;
    },
  },
};
