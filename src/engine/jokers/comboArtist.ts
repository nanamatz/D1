import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionSuits } from '../types';

/** U8 (GDD §11.3) — +Mult when this word shares no final register with the
 * previous phase. A gibberish hole on either side never counts as a change. */
export const comboArtist: JokerDef = {
  id: 'comboArtist',
  gddNumber: 8,
  nameKo: '콤보 아티스트',
  nameEn: 'Combo Artist',
  emoji: '🎨',
  rarity: 'uncommon',
  layer: 2,
  price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ blind, ctx }) => {
      const previous = blind.sequence.at(-1);
      const previousSuits = previous ? submissionSuits(previous) : [];
      const currentSuits = submissionSuits(ctx.submission);
      if (
        previousSuits.length > 0 &&
        currentSuits.length > 0 &&
        !currentSuits.some((suit) => previousSuits.includes(suit))
      ) {
        ctx.mult += BALANCE.jokers.comboArtist.mult;
      }
    },
  },
};
