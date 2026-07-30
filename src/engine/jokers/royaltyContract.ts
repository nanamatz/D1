import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const royaltyContract: JokerDef = {
  id: 'royaltyContract', gddNumber: 35, nameKo: '인세 계약', nameEn: 'Royalty Contract',
  emoji: '📜', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }, self) => {
      if (ctx.submission.isGibberish) return;
      const key = `seen:${ctx.submission.text}`;
      if (self.state[key]) return;
      self.state[key] = 1;
      ctx.goldDelta = (ctx.goldDelta ?? 0) + BALANCE.jokers.royaltyContract.gold;
    },
  },
};
