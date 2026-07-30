import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const correctionMark: JokerDef = {
  id: 'correctionMark', gddNumber: 41, nameKo: '교정 기호', nameEn: 'Correction Mark',
  emoji: '🩹', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      if (!ctx.submission.isGibberish && blind.sequence.at(-1)?.isGibberish) {
        ctx.mult += BALANCE.jokers.correctionMark.mult;
      }
    },
  },
};
