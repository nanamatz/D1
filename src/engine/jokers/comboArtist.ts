import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** U8 (GDD §11.3) — +Mult when this word's register differs from the previous
 *  phase's. Reads the CANONICAL suits, so a gibberish hole on either side
 *  (suit null) never counts as a change. */
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
      const previous = blind.sequence.at(-1)?.suit ?? null;
      const current = ctx.submission.suit;
      if (previous !== null && current !== null && previous !== current) {
        ctx.mult += BALANCE.jokers.comboArtist.mult;
      }
    },
  },
};
