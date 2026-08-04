import { BALANCE } from '../engine/balance';
import { onConstellationUsed, onTilesDestroyed } from '../engine/jokers';
import { newRun } from '../engine/run';
import { jokerSlotLimit } from '../engine/vouchers';
import { emojiTileBuyPrice } from '../engine/economy';

const run = newRun('emoji-sample');
run.jokers = [
  { defId: 'carteBlanche', state: {} },
  { defId: 'stargazer', state: {} },
  { defId: 'typeFoundry', state: {} },
];

const grown = onTilesDestroyed(onConstellationUsed(run), 2);

console.log({
  slots: jokerSlotLimit(grown),
  rareShopPrice: emojiTileBuyPrice(grown, BALANCE.jokerPrice.rare),
  stargazer: grown.jokers.find((joker) => joker.defId === 'stargazer')?.state.factor,
  typeFoundry: grown.jokers.find((joker) => joker.defId === 'typeFoundry')?.state.factor,
});
