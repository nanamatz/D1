import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const modifierStack: JokerDef = {
  id: 'modifierStack', gddNumber: 40, nameKo: '수식어 더미', nameEn: 'Modifier Stack',
  emoji: '📚', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx, scoreBeats }) => {
      if (ctx.submission.isGibberish) return;
      for (const _tag of ctx.posTags ?? []) {
        ctx.mult += BALANCE.jokers.modifierStack.multPerPosTag;
        scoreBeats?.push({ chipsDelta: 0, multDelta: BALANCE.jokers.modifierStack.multPerPosTag });
      }
    },
  },
};
