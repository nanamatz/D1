import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const civilTongue: JokerDef = {
  id: 'civilTongue', gddNumber: 14, nameKo: '정중한 입', nameEn: 'Civil Tongue',
  emoji: '🫧', rarity: 'uncommon', layer: 2, price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    wordScoring: ({ ctx }, self) => { ctx.mult += self.state.mult ?? 0; },
    blindEnd: ({ blind }, self) => {
      if (!blind.sequence.some((word) => word.suit === 'vulgar')) {
        self.state.mult = (self.state.mult ?? 0) + BALANCE.jokers.civilTongue.multPerBlind;
      }
    },
  },
};
