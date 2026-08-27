import { BALANCE } from '../balance';
import { hasScoringSuit, type JokerDef } from '../events';

export const formalInvitation: JokerDef = {
  id: 'formalInvitation', gddNumber: 11, nameKo: '격식 초대장', nameEn: 'Formal Invitation',
  emoji: '💌', rarity: 'uncommon', layer: 2, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (hasScoringSuit(ctx, 'formal')) {
        ctx.goldDelta = (ctx.goldDelta ?? 0) + BALANCE.jokers.formalInvitation.gold;
      }
    },
  },
};
