import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const scrapDealer: JokerDef = {
  scoresGibberish: true,
  id: 'scrapDealer', gddNumber: 22, nameKo: '고물상', nameEn: 'Scrap Dealer',
  emoji: '⚙️', rarity: 'uncommon', layer: 1, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    wordScoring: ({ run, ctx, scoreBeats }) => {
      const brass = run.bag.filter((tile) => tile.material === 'brass');
      for (const _tile of brass) {
        ctx.mult += BALANCE.jokers.scrapDealer.factorPerBrass;
        scoreBeats?.push({
          chipsDelta: 0,
          multDelta: BALANCE.jokers.scrapDealer.factorPerBrass,
        });
      }
    },
  },
};
