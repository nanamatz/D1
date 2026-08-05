import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import { submissionLength } from '../types';

export const longFormSerial: JokerDef = {
  id: 'longFormSerial', gddNumber: 27, nameKo: '장편 연재', nameEn: 'Long-form Serial',
  emoji: '📜', rarity: 'rare', layer: 1, price: BALANCE.jokerPrice.rare,
  multOperation: 'multiply',
  hooks: {
    tileScoring: ({ ctx, tile }) => {
      const index = ctx.submission.tiles.findIndex((candidate) => candidate.id === tile.id);
      if (index >= BALANCE.jokers.longFormSerial.freeLetters) {
        ctx.mult *= BALANCE.jokers.longFormSerial.factorPerLetter;
      }
    },
    wordScoring: ({ ctx, scoreBeats }) => {
      const physical = Math.max(
        0,
        ctx.submission.tiles.length - BALANCE.jokers.longFormSerial.freeLetters,
      );
      const effective = Math.max(
        0,
        submissionLength(ctx.submission) - BALANCE.jokers.longFormSerial.freeLetters,
      );
      for (let index = physical; index < effective; index += 1) {
        const before = ctx.mult;
        ctx.mult *= BALANCE.jokers.longFormSerial.factorPerLetter;
        scoreBeats?.push({
          chipsDelta: 0,
          multDelta: ctx.mult - before,
          multFactor: BALANCE.jokers.longFormSerial.factorPerLetter,
        });
      }
    },
  },
};
