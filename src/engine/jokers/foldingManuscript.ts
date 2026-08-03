import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const foldingManuscript: JokerDef = {
  id: 'foldingManuscript', gddNumber: 44, nameKo: '접는 원고', nameEn: 'Folding Manuscript',
  emoji: '📄', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    blindStart: ({ blind }, self) => {
      blind.handSizeTotal += self.state.handSize ?? BALANCE.jokers.foldingManuscript.handSize;
    },
    blindEnd: (_payload, self) => {
      self.state.handSize = Math.max(
        0,
        (self.state.handSize ?? BALANCE.jokers.foldingManuscript.handSize)
          - BALANCE.jokers.foldingManuscript.handSizeLostPerBlind,
      );
      if (self.state.handSize === 0) self.state.destroyed = 1;
    },
  },
};
