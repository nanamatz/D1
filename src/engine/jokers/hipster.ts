/** #12 Hipster (Uncommon, layer 2): +7 Mult if the word is Slang suit.
 *  Layer 2 is gated by suit, so it naturally never fires on gibberish
 *  (gibberish has suit = null, GDD §6.4 / §11.3). */
import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const hipster: JokerDef = {
  id: 'hipster',
  gddNumber: 12,
  nameKo: '힙스터',
  nameEn: 'Hipster',
  emoji: '🕶️',
  rarity: 'uncommon',
  layer: 2,
  price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (ctx.submission.suit === 'slang') ctx.mult += BALANCE.jokers.hipster.mult;
    },
  },
};
