import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const correctionMark: JokerDef = {
  id: 'correctionMark', gddNumber: 41, nameKo: '교정 기호', nameEn: 'Correction Mark',
  emoji: '🩹', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx, lookup }) => {
      const previous = blind.sequence.at(-1);
      if (!previous || previous.isGibberish || previous.debuffed || ctx.submission.isGibberish) return;
      const previousPos = lookup?.(previous.text)?.pos
        ?? (previous.posUsed ? [previous.posUsed] : []);
      const currentPos = ctx.posTags
        ?? (ctx.submission.posUsed ? [ctx.submission.posUsed] : []);
      if (currentPos.some((tag) => previousPos.includes(tag))) {
        ctx.mult += BALANCE.jokers.correctionMark.mult;
      }
    },
  },
};
