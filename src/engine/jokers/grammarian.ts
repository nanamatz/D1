/** #22 Grammarian (Rare, layer 3): ×2 Mult on completing any valid sentence
 *  pattern — the general amplifier (GDD §11.4). Fires at sentence scoring. */
import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const grammarian: JokerDef = {
  id: 'grammarian',
  gddNumber: 22,
  nameKo: '문법학자',
  nameEn: 'Grammarian',
  emoji: '📖',
  rarity: 'rare',
  layer: 3,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    sentenceScoring: ({ ctx }) => {
      if (ctx.match !== null) ctx.sentenceMult *= BALANCE.jokers.grammarian.totalMult;
    },
  },
};
