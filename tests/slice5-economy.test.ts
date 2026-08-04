import { describe, it, expect } from 'vitest';
import {
  blindTarget,
  clearReward,
  consumableBuyPrice,
  emojiTileBuyPrice,
  emojiTileSellValue,
  interest,
  rerollCost,
  sellValue,
} from '../src/engine/economy';
import { BALANCE } from '../src/engine/balance';
import { newRun } from '../src/engine/run';

describe('slice5 economy — blind target curve (GDD §8.2)', () => {
  it('ante 1: small ×1, big ×1.5, boss ×2', () => {
    // anteBaseTargets re-tuned 2026-07-30 (src/sim/length-mult.ts): [0]=300.
    // 300 × 1.0 = 300, 300 × 1.5 = 450, 300 × 2.0 = 600.
    expect(blindTarget(1, 'small')).toBe(300);
    expect(blindTarget(1, 'big')).toBe(450);
    expect(blindTarget(1, 'boss')).toBe(600);
  });

  it('reads the per-ante base from the curve table', () => {
    // anteBaseTargets[1]=900: 900 × 1.0 = 900, 900 × 1.5 = 1350.
    // anteBaseTargets[7]=105000: 105000 × 2.0 = 210000.
    expect(blindTarget(2, 'small')).toBe(900);
    expect(blindTarget(2, 'big')).toBe(1350);
    expect(blindTarget(8, 'boss')).toBe(210000); // 105000 × 2
  });

  it('uses the endless double-exponential curve after chapter 8', () => {
    expect(blindTarget(9, 'small')).toBe(240000);
  });
});

describe('slice5 economy — gold streams (GDD §9.1)', () => {
  it('clear reward by blind kind', () => {
    expect(clearReward('small')).toBe(3);
    expect(clearReward('big')).toBe(4);
    expect(clearReward('boss')).toBe(5);
  });

  it('interest is 1 per 5 held, capped at 5 (GDD §9.1)', () => {
    expect(interest(0)).toBe(0);
    expect(interest(4)).toBe(0);
    expect(interest(5)).toBe(1);
    expect(interest(24)).toBe(4);
    expect(interest(25)).toBe(5);
    expect(interest(100)).toBe(5); // cap
  });
});

describe('slice5 economy — shop costs (GDD §9.2)', () => {
  it('reroll costs base 5, +1 each subsequent reroll', () => {
    expect(rerollCost(0)).toBe(5);
    expect(rerollCost(1)).toBe(6);
    expect(rerollCost(3)).toBe(8);
  });

  it('selling returns half the purchase price, rounded down', () => {
    expect(sellValue(BALANCE.jokerPrice.common)).toBe(2); // 4 → 2
    expect(sellValue(BALANCE.jokerPrice.rare)).toBe(4); // 9 → 4
    expect(sellValue(BALANCE.jokerPrice.legendary)).toBe(7); // 15 → 7
    expect(sellValue(1)).toBe(1);
  });

  it('prices Emoji editions and Gambler cards, then recalculates sales at current discounts', () => {
    const fresh = newRun('prices');
    const discounted = { ...fresh, vouchers: ['newspaper' as const] };
    expect(BALANCE.jokerPrice).toEqual({ common: 4, uncommon: 6, rare: 9, legendary: 15 });
    expect(emojiTileBuyPrice(fresh, BALANCE.jokerPrice.common, 'rainbow')).toBe(9);
    expect(emojiTileBuyPrice(discounted, BALANCE.jokerPrice.rare)).toBe(6);
    expect(emojiTileSellValue(discounted, BALANCE.jokerPrice.rare)).toBe(3);
    expect(consumableBuyPrice(fresh, 'fable1')).toBe(3);
    expect(consumableBuyPrice(fresh, 'phoenix')).toBe(4);
  });
});
