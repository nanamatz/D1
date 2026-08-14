import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const scrapDealer: JokerDef = {
  id: 'scrapDealer', gddNumber: 22, nameKo: '고물상', nameEn: 'Scrap Dealer',
  emoji: '⚙️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  initialState: (run) => ({
    factor: 1 + run.bag.filter((tile) => tile.material === 'brass').length *
      BALANCE.jokers.scrapDealer.factorPerBrass,
  }),
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      const factor = 1 + run.bag.filter((tile) => tile.material === 'brass').length *
        BALANCE.jokers.scrapDealer.factorPerBrass;
      self.state.factor = factor;
      ctx.mult *= factor;
    },
  },
};
