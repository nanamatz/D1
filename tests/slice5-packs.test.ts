import { describe, it, expect } from 'vitest';
import { rollPack, applyPackPick, rollTile } from '../src/engine/packs';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import { BALANCE, packSizeRules } from '../src/engine/balance';
import { ORDINARY_GAMBLER_IDS } from '../src/engine/gamblerIds';
import type { Rng } from '../src/engine/rng';
import type { PackSize, PackSlot, PackType, RunState, ShopItem } from '../src/engine/types';

const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun('pack'), ...over });
const slot = (type: PackType, size: PackSize = 'normal'): PackSlot => ({ type, size, artVariant: 0 });
const fixedRng = (...values: number[]): Rng => ({
  next: () => values.shift() ?? 1,
  int: () => 0,
  shuffle: <T>(items: readonly T[]) => [...items],
});

describe('slice5 packs — sizes (feature-02 B)', () => {
  it('uses the adopted type and size weights', () => {
    expect(BALANCE.pack.typeWeights).toEqual({
      consumable: 4,
      pattern: 4,
      tile: 4,
      joker: 1.2,
      ink: 0.6,
    });
    expect(BALANCE.pack.sizeWeights).toEqual({ normal: 8, jumbo: 4, mega: 1 });
  });

  it('Normal shows 3 / picks 1; Jumbo 5 / 1; Mega 5 / 2', () => {
    expect(BALANCE.pack.size.normal).toMatchObject({ show: 3, pick: 1 });
    expect(BALANCE.pack.size.jumbo).toMatchObject({ show: 5, pick: 1 });
    expect(BALANCE.pack.size.mega).toMatchObject({ show: 5, pick: 2 });
  });

  it('a Mega Type pack shows 5 tiles and lets you pick 2', () => {
    const offer = rollPack(slot('tile', 'mega'), run(), makeRng('t'));
    expect(offer.type).toBe('tile');
    expect(offer.size).toBe('mega');
    expect(offer.pick).toBe(2);
    expect(offer.options.length).toBe(5);
    for (const o of offer.options) expect(o.kind).toBe('tile');
  });

  it('Charm and Ink packs show 2/4/4 while the other families show 3/5/5', () => {
    for (const type of ['joker', 'ink'] as const) {
      expect(packSizeRules(type, 'normal').show).toBe(2);
      expect(packSizeRules(type, 'jumbo').show).toBe(4);
      expect(packSizeRules(type, 'mega').show).toBe(4);
    }
    expect(packSizeRules('tile', 'normal').show).toBe(3);
    expect(packSizeRules('consumable', 'jumbo').show).toBe(5);
    expect(packSizeRules('pattern', 'mega').show).toBe(5);
  });
});

describe('slice5 packs — roll by type (GDD §9.3)', () => {
  it('Sticker (joker) pack offers not-owned jokers to choose', () => {
    const offer = rollPack(slot('joker'), run(), makeRng('e'));
    expect(offer.type).toBe('joker');
    expect(offer.options.length).toBeLessThanOrEqual(packSizeRules('joker', 'normal').show);
    for (const o of offer.options) expect(o.kind).toBe('joker');
  });

  it('Type (tile) pack shows letter tiles for the bag', () => {
    const offer = rollPack(slot('tile'), run(), makeRng('l'));
    for (const o of offer.options) {
      expect(o.kind).toBe('tile');
      if (o.kind === 'tile') {
        expect(o.tile.letter === null || /^[A-Z]$/.test(o.tile.letter)).toBe(true);
      }
    }
  });

  it('Typesetting (pattern) pack offers punctuation cards mapped to patterns', () => {
    const offer = rollPack(slot('pattern'), run(), makeRng('p'));
    expect(offer.options.length).toBe(3);
    for (const o of offer.options) {
      expect(o.kind).toBe('punctuation');
      if (o.kind === 'punctuation') expect(typeof o.pattern).toBe('string');
    }
  });

  it('is deterministic per seed', () => {
    expect(rollPack(slot('tile'), run(), makeRng('s'))).toEqual(rollPack(slot('tile'), run(), makeRng('s')));
  });

  it('excludes held consumables unless Copy Editor is owned', () => {
    const held = run({ consumables: ['fable1'] });
    const normal = rollPack(slot('consumable'), held, fixedRng(1, 1, 1));
    expect(normal.options.some((option) => option.kind === 'consumable' && option.id === 'fable1'))
      .toBe(false);

    const copied = rollPack(
      slot('consumable'),
      { ...held, jokers: [{ defId: 'copyEditor', edition: 'base', state: {} }] },
      fixedRng(1, 1, 1),
    );
    expect(copied.options.map((option) => option.kind === 'consumable' ? option.id : null))
      .toEqual(['fable1', 'fable1', 'fable1']);
  });

  it('excludes a live shop Fable from its pack even when Copy Editor allows repeats', () => {
    const copyEnabled = run({
      jokers: [{ defId: 'copyEditor', edition: 'base', state: {} }],
    });
    const live: ShopItem = { kind: 'consumable', id: 'fable1', price: 3 };
    const offer = rollPack(
      slot('consumable'),
      copyEnabled,
      fixedRng(1, 1, 1),
      [live],
    );
    expect(offer.options.map((option) => option.kind === 'consumable' ? option.id : null))
      .toEqual(['fable2', 'fable2', 'fable2']);
  });
});

describe('slice5 packs — jackpot and modifier policy', () => {
  it('keeps Phoenix and Deer exclusive to Ink Packs', () => {
    const fable = rollPack(slot('consumable'), run(), fixedRng(0, 0, 1));
    expect(fable.options.map((option) => option.kind === 'consumable' ? option.id : null))
      .toEqual(['fable1', 'fable2', 'fable3']);

    const constellation = rollPack(slot('pattern'), run(), fixedRng(0, 0, 1));
    expect(constellation.options.some((option) => option.kind === 'consumable')).toBe(false);

    const ink = rollPack(slot('ink'), run(), fixedRng(0.002999, 0.003));
    expect(ink.options.map((option) => option.kind === 'consumable' ? option.id : null))
      .toEqual(['phoenix', 'deer']);
  });

  it('uses 0.3% reserved bands and uniform odds for all 12 ordinary cards', () => {
    expect(BALANCE.pack.phoenixChance).toBe(0.003);
    expect(BALANCE.pack.deerChance).toBe(0.003);
    expect(ORDINARY_GAMBLER_IDS).toHaveLength(12);
    expect((1 - BALANCE.pack.phoenixChance - BALANCE.pack.deerChance) /
      ORDINARY_GAMBLER_IDS.length).toBeCloseTo(0.0828333, 6);

    const counts = new Map<string, number>();
    for (let seed = 0; seed < 4_000; seed += 1) {
      for (const option of rollPack(slot('ink'), run(), makeRng(`ink-weight-${seed}`)).options) {
        if (option.kind === 'consumable') counts.set(option.id, (counts.get(option.id) ?? 0) + 1);
      }
    }
    const ordinaryAverage = ORDINARY_GAMBLER_IDS.reduce(
      (sum, id) => sum + (counts.get(id) ?? 0), 0,
    ) / ORDINARY_GAMBLER_IDS.length;
    for (const id of ORDINARY_GAMBLER_IDS) {
      expect(counts.get(id) ?? 0).toBeGreaterThan(ordinaryAverage * 0.75);
      expect(counts.get(id) ?? 0).toBeLessThan(ordinaryAverage * 1.25);
    }
  });

  it('falls back to an ordinary card when a rolled jackpot is ineligible', () => {
    const phoenixOwned = run({ consumables: ['phoenix'] });
    const offer = rollPack(slot('ink'), phoenixOwned, fixedRng(0.001, 1));
    expect(offer.options[0]).toMatchObject({ kind: 'consumable', id: 'barnSwallow' });
    expect(offer.options.some((option) =>
      option.kind === 'consumable' && option.id === 'deer',
    )).toBe(false);

    const ordinary = rollPack(slot('ink'), run(), fixedRng(0.006, 1));
    expect(ordinary.options[0]).toMatchObject({ kind: 'consumable', id: 'barnSwallow' });
  });

  it('pack material and font rolls are independent; shop tiles never gain a font', () => {
    const packed = rollTile(run(), fixedRng(0, 0, 1), 0, 'pack');
    expect(packed.material).not.toBe('ceramic');
    expect(packed.font).not.toBe('medium');
    expect(packed.edition).toBe('base');

    const shopped = rollTile(run(), fixedRng(0, 1), 0, 'shop');
    expect(shopped.material).not.toBe('ceramic');
    expect(shopped.font).toBe('medium');
    expect(shopped.edition).toBe('base');
  });

  it('never attaches a rolled font to Stone', () => {
    const ints = [0, 3, 0];
    const stone = rollTile(run(), {
      next: () => 0,
      int: () => ints.shift() ?? 0,
      shuffle: <T>(items: readonly T[]) => [...items],
    }, 0, 'pack');
    expect(stone.material).toBe('stone');
    expect(stone.font).toBe('medium');
  });
});

describe('slice5 packs — apply a pick', () => {
  it('a joker pick is added to the run', () => {
    const offer = rollPack(slot('joker'), run(), makeRng('e'));
    const r = applyPackPick(run(), offer.options[0]!);
    expect(r.jokers.length).toBe(1);
  });

  it('a stale joker pick cannot duplicate an owned Emoji Tile', () => {
    const owned = run({ jokers: [{ defId: 'hypocrite', edition: 'base', state: {} }] });
    const result = applyPackPick(owned, {
      kind: 'joker',
      id: 'hypocrite',
      edition: 'base',
    });
    expect(result).toBe(owned);
  });

  it('a tile pick is added to the bag', () => {
    const offer = rollPack(slot('tile'), run(), makeRng('l'));
    const before = run().bag.length;
    const r = applyPackPick(run(), offer.options[0]!);
    expect(r.bag.length).toBe(before + 1);
  });

  it('a punctuation pick enters the consumable zone and waits to be used', () => {
    const offer = rollPack(slot('pattern'), run(), makeRng('p'));
    const opt = offer.options[0]!;
    if (opt.kind !== 'punctuation') throw new Error('expected punctuation');
    const before = run().patternLevels[opt.pattern];
    const r = applyPackPick(run(), opt);
    expect(r.patternLevels[opt.pattern]).toBe(before);
    expect(r.consumables).toContain(opt.id);
  });

  it('a consumable pick respects consumable slots', () => {
    const offer = rollPack(slot('consumable'), run(), makeRng('c'));
    const full = run({ consumables: ['magnifier', 'magnifier'] }); // slots = 2
    expect(applyPackPick(full, offer.options[0]!).consumables.length).toBe(2); // no room → unchanged
  });

});

describe('slice5 — Type packs stock every non-base material (GDD §9.3)', () => {
  it('can roll every material across many seeds, and stone tiles are letterless', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const r = { ...newRun(`pk${i}`), bag: [] };
      const offer = rollPack(slot('tile', 'mega'), r, makeRng(`pk${i}`));
      for (const o of offer.options) {
        if (o.kind !== 'tile') continue;
        seen.add(o.tile.material);
        // The invariant that makes Stone work (GDD §2.2)
        if (o.tile.material === 'stone') {
          expect(o.tile.letter).toBeNull();
          expect(o.tile.letterBeforeStone).toMatch(/^[A-Z]$/);
        } else expect(o.tile.letter).not.toBeNull();
      }
    }
    for (const m of ['porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass']) {
      expect(seen.has(m)).toBe(true);
    }
  });
});
