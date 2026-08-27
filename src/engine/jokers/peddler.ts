import { BALANCE } from '../balance';
import { emojiTileSellValue } from '../economy';
import type { JokerDef } from '../events';

export const peddler: JokerDef = {
  scoresGibberish: true,
  id: 'peddler', gddNumber: 50, nameKo: '행상인', nameEn: 'Peddler',
  emoji: '🧳', rarity: 'common', layer: 1, price: BALANCE.jokerPrice.common,
  hooks: {
    wordScoring: ({ run, ctx }, _self, env) => {
      ctx.mult += run.jokers.reduce((total, owned) => {
        const def = env.lookup(owned.defId);
        return total + (def ? emojiTileSellValue(
          run,
          def.price,
          owned.edition ?? 'base',
          owned.state.sellBonus ?? 0,
        ) : 0);
      }, 0);
    },
  },
};
