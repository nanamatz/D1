import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const alphabetPoet: JokerDef = {
  id: 'alphabetPoet', gddNumber: 57, nameKo: '알파벳 시인', nameEn: 'Alphabet Poet',
  emoji: '↗', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  hooks: {
    sentenceScoring: ({ ctx }, self, env) => {
      if (ctx.sequence.length < BALANCE.jokers.alphabetPoet.minWords) return;
      const initials = ctx.sequence.map((word) =>
        word.isGibberish ? '' : word.text[0]?.toUpperCase() ?? '');
      if (initials.some((letter) => letter === '')) return;
      if (!initials.every((letter, index) => index === 0 || initials[index - 1]! < letter)) return;
      ctx.sentenceMult *= BALANCE.jokers.alphabetPoet.factor;
      ctx.jokerTriggers?.push({
        jokerId: self.defId,
        jokerIndex: env.index,
        chipsDelta: 0,
        multFactor: BALANCE.jokers.alphabetPoet.factor,
      });
    },
  },
};
