import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const storyteller: JokerDef = {
  scoresGibberish: true,
  id: 'storyteller', gddNumber: 51, nameKo: '이야기꾼', nameEn: 'Storyteller',
  emoji: '📖', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  initialState: (run) => ({
    mult: (run.fablesUsed ?? 0) * BALANCE.jokers.storyteller.multPerFable,
  }),
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    fableUsed: ({ run }, self) => {
      self.state.mult = (run.fablesUsed ?? 0) * BALANCE.jokers.storyteller.multPerFable;
    },
    wordScoring: ({ run, ctx }, self) => {
      self.state.mult = (run.fablesUsed ?? 0) * BALANCE.jokers.storyteller.multPerFable;
      ctx.mult += self.state.mult;
    },
  },
};
