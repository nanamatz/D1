import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const bloodTypeA: JokerDef = {
  id: 'bloodTypeA', gddNumber: 48, nameKo: '혈액형 A', nameEn: 'Blood Type A',
  emoji: '🩸', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    tileScoring: ({ tile }, self) => {
      if (tile.letter === 'A' || tile.letter === 'O') {
        self.state.chips = (self.state.chips ?? 0) + BALANCE.jokers.bloodTypeA.chipsPerLetter;
      }
    },
    wordScoring: ({ ctx }, self) => {
      ctx.chips += self.state.chips ?? 0;
    },
  },
};
