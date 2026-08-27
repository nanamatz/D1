import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const cadmusTeeth: JokerDef = {
  scoresGibberish: true,
  id: 'cadmusTeeth', gddNumber: 54, nameKo: '카드모스의 이빨', nameEn: "Cadmus's Teeth",
  emoji: '🦷', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  initialState: (run) => ({
    chips: (run.discardedLetters?.length ?? 0) * BALANCE.jokers.cadmusTeeth.chipsPerLetter,
    ...Object.fromEntries((run.discardedLetters ?? []).map((letter) => [`seen_${letter}`, 1])),
  }),
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    tilesDiscarded: ({ tiles }, self) => {
      for (const tile of tiles) {
        if (!tile.letter || self.state[`seen_${tile.letter}`] === 1) continue;
        self.state[`seen_${tile.letter}`] = 1;
        self.state.chips = (self.state.chips ?? 0) + BALANCE.jokers.cadmusTeeth.chipsPerLetter;
      }
    },
    wordScoring: ({ ctx }, self) => { ctx.chips += self.state.chips ?? 0; },
  },
};
