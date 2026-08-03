import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionSuits } from '../types';

export const correctionMark: JokerDef = {
  id: 'correctionMark', gddNumber: 41, nameKo: '교정 기호', nameEn: 'Correction Mark',
  emoji: '🩹', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence.at(-1);
      const previousSuits = previous ? submissionSuits(previous) : [];
      const currentSuits = submissionSuits(ctx.submission);
      if (currentSuits.some((suit) => previousSuits.includes(suit))) {
        ctx.mult += BALANCE.jokers.correctionMark.mult;
      }
    },
  },
};
