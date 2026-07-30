import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const modifierStack: JokerDef = {
  id: 'modifierStack', gddNumber: 40, nameKo: '수식어 더미', nameEn: 'Modifier Stack',
  emoji: '📚', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    sentenceScoring: ({ ctx }) => {
      ctx.sentenceChips += (ctx.match?.absorbedModifiers ?? 0)
        * BALANCE.jokers.modifierStack.chipsPerModifier;
    },
  },
};
