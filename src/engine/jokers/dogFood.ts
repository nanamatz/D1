import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const dogFood: JokerDef = {
  id: 'dogFood', gddNumber: 59, nameKo: '개 사료', nameEn: 'Dog Food',
  emoji: '🐕', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  initialState: () => ({ mult: 0 }),
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    shopRerolled: (_payload, self) => {
      self.state.mult = (self.state.mult ?? 0) + BALANCE.jokers.dogFood.multPerReroll;
    },
    wordScoring: ({ ctx }, self) => { ctx.mult += self.state.mult ?? 0; },
  },
};
