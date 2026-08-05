import { BALANCE } from '../balance';
import { emojiTileSellValue } from '../economy';
import type { JokerDef } from '../events';

export const host: JokerDef = {
  id: 'host',
  gddNumber: 50,
  nameKo: '숙주',
  nameEn: 'Host',
  emoji: '🦠',
  rarity: 'uncommon',
  layer: 1,
  price: BALANCE.jokerPrice.uncommon,
  growthDisplay: { kind: 'multAdd', stateKey: 'mult', initial: 0 },
  hooks: {
    blindSelected: ({ run, triggers }, self, env) => {
      const left = run.jokers[env.index - 1];
      if (!left || left.state.destroyed === 1) return;
      const def = env.lookup(left.defId);
      const value = def
        ? emojiTileSellValue(
            run,
            BALANCE.jokerPrice[def.rarity],
            left.edition ?? 'base',
            left.state.sellBonus ?? 0,
          )
        : 1;
      left.state.destroyed = 1;
      self.state.mult = (self.state.mult ?? 0) + value * BALANCE.jokers.host.multPerSellValue;
      triggers.push({ joker: self, jokerIndex: env.index, createdTiles: [] });
    },
    wordScoring: ({ ctx }, self) => {
      ctx.mult += self.state.mult ?? 0;
    },
  },
};
