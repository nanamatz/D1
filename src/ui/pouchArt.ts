import type { PouchId } from '../engine/types';
import yellow from './assets/pouches/yellow.png';
import blue from './assets/pouches/blue.png';
import green from './assets/pouches/green.png';
import purple from './assets/pouches/purple.png';
import lucky from './assets/pouches/lucky.png';
import fiveColor from './assets/pouches/five-color.png';
import golden from './assets/pouches/golden.png';
import leather from './assets/pouches/leather.png';
import military from './assets/pouches/military.png';
import luxury from './assets/pouches/luxury.png';
import pencilCase from './assets/pouches/pencil-case.png';
import lunchBag from './assets/pouches/lunch-bag.png';
import shoppingBasket from './assets/pouches/shopping-basket.png';
import coinPurse from './assets/pouches/coin-purse.png';

/** UI-only pouch art. Engine pouch definitions stay headless. */
export const POUCH_ART: Record<PouchId, string> = {
  yellow,
  blue,
  green,
  purple,
  lucky,
  fiveColor,
  golden,
  leather,
  military,
  luxury,
  pencilCase,
  lunchBag,
  shoppingBasket,
  coinPurse,
};

export function pouchArt(id: PouchId): string {
  return POUCH_ART[id];
}
