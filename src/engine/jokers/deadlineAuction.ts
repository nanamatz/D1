import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const deadlineAuction: JokerDef = {
  scoresGibberish: true,
  id: 'deadlineAuction', gddNumber: 43, nameKo: '마감 경매', nameEn: 'Deadline Auction',
  emoji: '🔨', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  growthDisplay: { kind: 'mult', stateKey: 'factor', initial: 1 },
  multOperation: 'multiply',
  hooks: {
    blindEnd: ({ run, blind }, self, env) => {
      if (blind.kind !== 'boss') return;
      const steps = Math.floor(run.gold / BALANCE.jokers.deadlineAuction.goldPerGrowth);
      for (let step = 0; step < steps; step += 1) {
        self.state.factor = (self.state.factor ?? 1) + BALANCE.jokers.deadlineAuction.factorPerStep;
        env.grow('mult', BALANCE.jokers.deadlineAuction.factorPerStep);
      }
      run.gold = 0;
    },
    wordScoring: ({ ctx }, self) => { ctx.mult *= self.state.factor ?? 1; },
  },
};
