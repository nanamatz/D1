import { BALANCE } from '../balance';
import type { JokerDef } from '../events';

export const scrapDealer: JokerDef = {
  id: 'scrapDealer', gddNumber: 22, nameKo: '고물상', nameEn: 'Scrap Dealer',
  emoji: '⚙️', rarity: 'uncommon', layer: 3, price: BALANCE.jokerPrice.uncommon,
  hooks: {
    tilesDestroyed: ({ run, count }) => { run.gold += count * BALANCE.jokers.scrapDealer.goldPerTile; },
  },
};
