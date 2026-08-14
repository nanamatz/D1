import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { letterChips } from '../scoring';

export const gematria: JokerDef = {
  id: 'gematria', gddNumber: 53, nameKo: '게마트리아', nameEn: 'Gematria',
  emoji: '≡', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence[blind.sequence.length - 1];
      if (ctx.submission.isGibberish || !previous || previous.isGibberish) return;
      if (letterChips(ctx.submission.tiles) === letterChips(previous.tiles)) {
        ctx.mult += BALANCE.jokers.gematria.mult;
      }
    },
  },
};
