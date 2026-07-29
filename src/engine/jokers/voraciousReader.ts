import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

/** U5 (GDD §11.3) — ★ +1 Chips per word made so far, accumulating for the run.
 *  The current word pays the total BEFORE itself, then the counter ticks. */
export const voraciousReader: JokerDef = {
  id: 'voraciousReader',
  gddNumber: 5,
  nameKo: '다독가',
  nameEn: 'Voracious Reader',
  emoji: '🤓',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    wordScoring: ({ ctx }, self) => {
      ctx.chips += self.state.chips ?? 0;
      self.state.chips = (self.state.chips ?? 0) + BALANCE.jokers.voraciousReader.chipsPerWord;
    },
  },
};
