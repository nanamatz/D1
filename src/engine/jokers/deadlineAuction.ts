import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const deadlineAuction: JokerDef = {
  id: 'deadlineAuction', gddNumber: 43, nameKo: '마감 경매', nameEn: 'Deadline Auction',
  emoji: '🔨', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    blindEnd: ({ run, blind }, self) => {
      if (blind.kind !== 'boss') return;
      const steps = Math.floor(run.gold / BALANCE.jokers.deadlineAuction.goldPerGrowth);
      self.state.factor = (self.state.factor ?? 1) +
        steps * BALANCE.jokers.deadlineAuction.factorPerStep;
      run.gold = 0;
    },
    wordScoring: ({ ctx }, self) => { ctx.mult *= self.state.factor ?? 1; },
  },
};
