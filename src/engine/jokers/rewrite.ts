import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const rewrite: JokerDef = {
  scoresGibberish: true,
  id: 'rewrite', gddNumber: 29, nameKo: '재작성', nameEn: 'Rewrite',
  emoji: '🖊️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    wordScoring: ({ ctx }, self) => { ctx.mult += self.state.mult ?? 0; },
    discardUsed: (_payload, self) => {
      self.state.mult = (self.state.mult ?? 0) + BALANCE.jokers.rewrite.multPerDiscard;
    },
    blindEnd: (_payload, self) => { self.state.mult = 0; },
  },
};
