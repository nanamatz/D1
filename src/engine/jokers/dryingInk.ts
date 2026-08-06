import { BALANCE } from '../balance';
import { isScoringVowel, type JokerDef } from '../events';

export const dryingInk: JokerDef = {
  id: 'dryingInk', gddNumber: 43, nameKo: '마르는 잉크', nameEn: 'Drying Ink',
  emoji: '🖋️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  growthDisplay: {
    kind: 'multAdd',
    stateKey: 'mult',
    initial: BALANCE.jokers.dryingInk.mult,
    showDecrease: true,
  },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      const current = self.state.mult ?? BALANCE.jokers.dryingInk.mult;
      ctx.mult += current;
      if (ctx.submission.tiles.some((tile) => isScoringVowel(ctx, tile.letter))) {
        self.state.mult = Math.max(0, current - BALANCE.jokers.dryingInk.multLostPerVowelWord);
        if (self.state.mult === 0) self.state.destroyed = 1;
      }
    },
  },
};
