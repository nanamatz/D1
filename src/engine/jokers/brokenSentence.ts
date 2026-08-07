import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const brokenSentence: JokerDef = {
  id: 'brokenSentence', gddNumber: 39, nameKo: '깨진 문장', nameEn: 'Broken Sentence',
  emoji: '💔', rarity: 'rare', layer: 3, price: BALANCE.jokerPrice.rare,
  hooks: {
    sentenceScoring: ({ ctx }, self, env) => {
      if (!ctx.match) {
        ctx.sentenceChips += BALANCE.jokers.brokenSentence.chips;
        ctx.sentenceMult *= BALANCE.jokers.brokenSentence.mult;
        ctx.jokerTriggers?.push({
          jokerId: self.defId,
          jokerIndex: env.index,
          chipsDelta: BALANCE.jokers.brokenSentence.chips,
          multFactor: BALANCE.jokers.brokenSentence.mult,
        });
      }
    },
  },
};
