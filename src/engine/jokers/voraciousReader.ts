import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const voraciousReaderChips = (totalWords: number): number =>
  totalWords * BALANCE.jokers.voraciousReader.chipsPerWord;

/** U5 (GDD §11.3) — ★ +5 Chips per word made so far, accumulating for the run.
 *  The current word pays the total BEFORE itself, then the counter ticks. */
export const voraciousReader: JokerDef = {
  scoresGibberish: true,
  id: 'voraciousReader',
  gddNumber: 5,
  nameKo: '다독가',
  nameEn: 'Voracious Reader',
  emoji: '🤓',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  initialState: (run) => ({ chips: voraciousReaderChips(run.counters.totalWords) }),
  growthDisplay: { kind: 'chips', stateKey: 'chips', initial: 0 },
  hooks: {
    wordScoring: ({ run, ctx }, self) => {
      const chips = Math.max(
        self.state.chips ?? 0,
        voraciousReaderChips(run.counters.totalWords),
      );
      ctx.chips += chips;
      if (!ctx.submission.isGibberish) {
        self.state.chips = chips + BALANCE.jokers.voraciousReader.chipsPerWord;
      }
    },
  },
};
