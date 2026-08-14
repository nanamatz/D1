import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

const LETTERS = Object.keys(BALANCE.letterChips);

export const bald: JokerDef = {
  id: 'bald', gddNumber: 56, nameKo: '대머리', nameEn: 'Bald',
  emoji: '🧑‍🦲', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  multOperation: 'multiply', multDisplayFactor: BALANCE.jokers.bald.factor,
  hooks: {
    blindSelected: ({ rng, triggers }, self, env) => {
      self.state.letterCode = LETTERS[rng.int(LETTERS.length)]!.charCodeAt(0);
      triggers.push({ joker: self, jokerIndex: env.index, createdTiles: [] });
    },
    tileScoring: ({ ctx, tile }, self) => {
      if (tile.letter?.charCodeAt(0) === self.state.letterCode) {
        ctx.mult *= BALANCE.jokers.bald.factor;
      }
    },
  },
};
