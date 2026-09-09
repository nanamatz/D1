import { BALANCE } from '../balance';
import type { JokerDef } from '../events';
import type { RunState } from '../types';

/** Current additive Mult from Brass tiles in the permanent pouch. */
export const scrapDealerMult = (run: Pick<RunState, 'bag'>): number =>
  run.bag.filter((tile) => tile.material === 'brass').length
  * BALANCE.jokers.scrapDealer.factorPerBrass;

export const scrapDealer: JokerDef = {
  scoresGibberish: true,
  id: 'scrapDealer', gddNumber: 22, nameKo: '고물상', nameEn: 'Scrap Dealer',
  emoji: '⚙️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ run, ctx, scoreBeats }) => {
      const mult = scrapDealerMult(run);
      if (mult === 0) return;
      ctx.mult += mult;
      scoreBeats?.push({ chipsDelta: 0, multDelta: mult });
    },
  },
};
