import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const scrapDealer: JokerDef = {
  id: 'scrapDealer', gddNumber: 22, nameKo: '고물상', nameEn: 'Scrap Dealer',
  emoji: '⚙️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'gold', stateKey: 'goldPaid', initial: 0, showInTooltip: false },
  hooks: {
    tilesDestroyed: ({ run, count }, self) => {
      const payout = count * BALANCE.jokers.scrapDealer.goldPerTile;
      run.gold += payout;
      self.state.goldPaid = (self.state.goldPaid ?? 0) + payout;
    },
  },
};
