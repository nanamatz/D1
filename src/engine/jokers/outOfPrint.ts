import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const ALPHABET = Object.keys(BALANCE.bagComposition);

/** How many of the 26 letters have no copies left in the permanent pouch. */
export const extinctLetterCount = (bag: readonly { letter: string | null }[]): number => {
  const present = new Set(bag.map((tile) => tile.letter).filter((l): l is string => l !== null));
  return ALPHABET.filter((letter) => !present.has(letter)).length;
};

/**
 * R4 (GDD §11.4) — ★ +25 Chips and +3 Mult for every alphabet letter that has
 * been wiped from the permanent pouch. Read live off `run.bag` rather than
 * latched into state: the pouch only shrinks through permanent destruction, and
 * a live read stays correct if a Gambler card ever puts a letter family back.
 */
export const outOfPrint: JokerDef = {
  id: 'outOfPrint',
  gddNumber: 4,
  nameKo: '절판',
  nameEn: 'Out of Print',
  emoji: '🚫',
  rarity: 'rare',
  layer: 1,
  price: BALANCE.jokerPrice.rare,
  hooks: {
    wordScoring: ({ run, ctx }) => {
      const gone = extinctLetterCount(run.bag);
      if (gone === 0) return;
      ctx.chips += gone * BALANCE.jokers.outOfPrint.chipsPerLetter;
      ctx.mult += gone * BALANCE.jokers.outOfPrint.multPerLetter;
    },
  },
};
