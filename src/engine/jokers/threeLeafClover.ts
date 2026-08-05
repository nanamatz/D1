import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const threeLeafClover: JokerDef = {
  id: 'threeLeafClover', gddNumber: 33, nameKo: '세잎클로버', nameEn: 'Three-Leaf Clover',
  emoji: '☘️', rarity: 'common', layer: 3, price: BALANCE.jokerPrice.common,
  growthDisplay: { kind: 'gold', stateKey: 'sellBonus', initial: 0 },
  hooks: {
    blindEnd: (_payload, self) => {
      self.state.sellBonus = (self.state.sellBonus ?? 0) + BALANCE.jokers.threeLeafClover.sellValuePerBlind;
    },
  },
};
