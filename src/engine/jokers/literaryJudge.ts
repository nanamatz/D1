import { BALANCE } from '../balance';
import { hasScoringSuit, type JokerDef } from '../events';

/** U1 (GDD §11.3) — +Chips on Formal words. Reads the VIRTUAL scoring suits so
 *  Tower of Babel / Tyrant widen it, layer 1–2 (never fires on gibberish). */
export const literaryJudge: JokerDef = {
  id: 'literaryJudge',
  gddNumber: 1,
  nameKo: '문학 심사위원',
  nameEn: 'Literary Judge',
  emoji: '⚖️',
  rarity: 'uncommon',
  layer: 2,
  price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ ctx }) => {
      if (hasScoringSuit(ctx, 'formal')) ctx.chips += BALANCE.jokers.literaryJudge.chips;
    },
  },
};
