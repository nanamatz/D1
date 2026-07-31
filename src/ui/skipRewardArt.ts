import type { SkipRewardId } from '../engine/types';
import advancePayment from './assets/skip-rewards/advance-payment.png';
import houseStyle from './assets/skip-rewards/house-style.png';
import extraPages from './assets/skip-rewards/extra-pages.png';
import copyPass from './assets/skip-rewards/copy-pass.png';
import leadStory from './assets/skip-rewards/lead-story.png';
import quotaRelief from './assets/skip-rewards/quota-relief.png';
import publicity from './assets/skip-rewards/publicity.png';
import coverQuote from './assets/skip-rewards/cover-quote.png';
import uncommonTag from './assets/skip-rewards/uncommon-tag.png';
import rareTag from './assets/skip-rewards/rare-tag.png';
import whiteTag from './assets/skip-rewards/white-tag.png';
import violetTag from './assets/skip-rewards/violet-tag.png';
import rainbowTag from './assets/skip-rewards/rainbow-tag.png';
import grayTag from './assets/skip-rewards/gray-tag.png';
import investmentTag from './assets/skip-rewards/investment-tag.png';
import voucherTag from './assets/skip-rewards/voucher-tag.png';
import bossTag from './assets/skip-rewards/boss-tag.png';
import tileTag from './assets/skip-rewards/tile-tag.png';
import fableTag from './assets/skip-rewards/fable-tag.png';
import constellationTag from './assets/skip-rewards/constellation-tag.png';
import charmTag from './assets/skip-rewards/charm-tag.png';
import handyTag from './assets/skip-rewards/handy-tag.png';
import garbageTag from './assets/skip-rewards/garbage-tag.png';
import inkTag from './assets/skip-rewards/ink-tag.png';
import couponTag from './assets/skip-rewards/coupon-tag.png';
import jugglerTag from './assets/skip-rewards/juggler-tag.png';
import economyTag from './assets/skip-rewards/economy-tag.png';

/** UI-only art for every Editorial Perk. The headless engine keeps ids/effects only. */
export const SKIP_REWARD_ART: Record<SkipRewardId, string> = {
  advancePayment,
  houseStyle,
  extraPages,
  copyPass,
  leadStory,
  quotaRelief,
  publicity,
  coverQuote,
  uncommonTag,
  rareTag,
  whiteTag,
  violetTag,
  rainbowTag,
  grayTag,
  investmentTag,
  voucherTag,
  bossTag,
  tileTag,
  fableTag,
  constellationTag,
  charmTag,
  handyTag,
  garbageTag,
  inkTag,
  couponTag,
  jugglerTag,
  economyTag,
};
