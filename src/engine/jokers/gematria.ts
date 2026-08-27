import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const gematria: JokerDef = {
  id: 'gematria', gddNumber: 53, nameKo: '게마트리아', nameEn: 'Gematria',
  emoji: '≡', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx, scoreBeats }) => {
      if (ctx.submission.isGibberish) return;
      const word = ctx.submission.text.toUpperCase();
      const count = blind.sequence.filter((prior) =>
        !prior.isGibberish && !prior.debuffed && prior.text.toUpperCase() === word).length + 1;
      ctx.mult += count * BALANCE.jokers.gematria.mult;
      for (let index = 0; index < count; index += 1) {
        scoreBeats?.push({ chipsDelta: 0, multDelta: BALANCE.jokers.gematria.mult });
      }
    },
  },
};
