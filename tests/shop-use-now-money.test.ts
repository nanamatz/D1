import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { jokerSellGoldValue, useFable } from '../src/engine/fables';
import { startBlind } from '../src/engine/loop';
import { newRun } from '../src/engine/run';
import type { Rng } from '../src/engine/rng';
import {
  buildConsumableEffect,
  shopUseNowMoneyDeltas,
} from '../src/ui/consumableEffect';
import {
  MoneyLedger,
  moneyDeltaText,
  resolveMoneyLedgerEvent,
} from '../src/ui/components/MoneyValue';

const zeroRng: Rng = {
  next: () => 0,
  int: () => 0,
  shuffle: <T>(items: readonly T[]) => items.slice(),
};

const source = (path: string): string => readFileSync(path, 'utf8');

describe('Shop Use Now money-gaining Fable ledger', () => {
  it('presents Goose cost then its full post-price payout while state commits atomically', () => {
    const starting = { ...newRun('shop-use-now-goose'), gold: 10, consumables: ['fable9' as const] };
    const blind = startBlind(starting, zeroRng);
    const paid = { ...starting, gold: starting.gold - 3 };
    const result = useFable('fable9', paid, blind, [], zeroRng);
    const deltas = shopUseNowMoneyDeltas('fable9', 3, paid, result.run);
    const event = buildConsumableEffect('fable9', paid, result.run, result.chanceResults, deltas);

    expect(result.ok).toBe(true);
    expect(result.run.gold).toBe(14);
    expect(deltas).toEqual([-3, 7]);
    expect(starting.gold + deltas.reduce((sum, delta) => sum + delta, 0)).toBe(result.run.gold);
    expect(event.goldDelta).toBe(7);
    expect(event.moneyDeltas).toEqual([-3, 7]);
  });

  it('keeps Heavenly Maiden full payout and limits the ledger to registry money effects', () => {
    const starting = {
      ...newRun('shop-use-now-maiden'),
      gold: 12,
      consumables: ['fable17' as const],
      jokers: [{ defId: 'hypocrite', edition: 'base' as const, state: {} }],
    };
    const blind = startBlind(starting, zeroRng);
    const paid = { ...starting, gold: starting.gold - 2 };
    const payout = jokerSellGoldValue(paid);
    const result = useFable('fable17', paid, blind, [], zeroRng);

    expect(result.run.gold).toBe(paid.gold + payout);
    expect(shopUseNowMoneyDeltas('fable17', 2, paid, result.run)).toEqual([-2, payout]);
    expect(shopUseNowMoneyDeltas('fable1', 2, paid, result.run)).toEqual([]);
  });

  it('omits only zero beats, including a zero-net transaction', () => {
    const goose = { ...newRun('shop-use-now-zero'), gold: 3, consumables: ['fable9' as const] };
    const gooseBlind = startBlind(goose, zeroRng);
    const emptyPaid = { ...goose, gold: 0 };
    const noPayout = useFable('fable9', emptyPaid, gooseBlind, [], zeroRng);
    expect(shopUseNowMoneyDeltas('fable9', 3, emptyPaid, noPayout.run)).toEqual([-3]);

    const freeResult = useFable('fable9', goose, gooseBlind, [], zeroRng);
    expect(shopUseNowMoneyDeltas('fable9', 0, goose, freeResult.run)).toEqual([3]);

    const netZeroPaid = { ...goose, gold: 3 };
    const netZero = useFable('fable9', netZeroPaid, gooseBlind, [], zeroRng);
    expect(shopUseNowMoneyDeltas('fable9', 3, netZeroPaid, netZero.run)).toEqual([-3, 3]);
  });

  it('renders explicit formatted signs in spend-then-gain DOM order for Reduced Motion', () => {
    const markup = renderToStaticMarkup(createElement(MoneyLedger, {
      deltas: [-3, 10_000_000, 0],
      sequence: 4,
      reduced: true,
    }));

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('is-reduced');
    expect(markup.indexOf('-$3')).toBeLessThan(markup.indexOf('+$1e7'));
    expect(markup.match(/money-ledger-beat/g)).toHaveLength(2);
    expect(moneyDeltaText(-1234)).toBe('-$1,234');
  });

  it('gives two co-mounted readouts one live ledger while both suppress the matching net pop', () => {
    const sidebar = resolveMoneyLedgerEvent(10, 14, [-3, 7], false);
    const shop = resolveMoneyLedgerEvent(10, 14, [-3, 7], true);
    const markup = renderToStaticMarkup(createElement(
      'div',
      null,
      createElement(MoneyLedger, { deltas: sidebar.ledgerDeltas }),
      createElement(MoneyLedger, { deltas: shop.ledgerDeltas }),
    ));

    expect(sidebar.suppressValue).toBe(14);
    expect(shop.suppressValue).toBe(14);
    expect(sidebar.ledgerDeltas).toEqual([]);
    expect(shop.ledgerDeltas).toEqual([-3, 7]);
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup.match(/aria-live="polite"/g)).toHaveLength(1);
  });

  it('keeps one successful updater transaction and queues presentation without net-popup replay', () => {
    const game = source('src/ui/useGame.ts');
    const money = source('src/ui/components/MoneyValue.tsx');
    const shop = source('src/ui/components/Shop.tsx');
    const sidebar = source('src/ui/components/Sidebar.tsx');
    const buyAndUse = game.slice(game.indexOf('const buyAndUse'), game.indexOf('const playWord'));

    expect(buyAndUse).toContain('if (prev.run.gold < item.price) return prev;');
    expect(buyAndUse).toContain('gold: prev.run.gold - item.price');
    expect(buyAndUse).toContain('const next = applyConsumable(paid, id, item.price);');
    expect(game).toContain('shopUseNowMoneyDeltas(id, shopPrice, prev.run, result.run)');
    expect(money).toContain('setLedgerQueue((queue) => [...queue, {');
    expect(money).toContain('if (suppressValue.current === value)');
    expect(money).toContain('queue.slice(1)');
    expect(shop).toContain('<MoneyValue value={run.gold} presentLedger />');
    expect(sidebar).toContain('<MoneyValue value={run.gold} />');
  });
});
