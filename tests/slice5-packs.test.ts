import { describe, it, expect } from 'vitest';
import { rollPack, applyPackPick } from '../src/engine/packs';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import { BALANCE } from '../src/engine/balance';
import type { PackSize, PackSlot, PackType, RunState } from '../src/engine/types';

const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun('pack'), ...over });
const slot = (type: PackType, size: PackSize = 'normal'): PackSlot => ({ type, size, artVariant: 0 });

describe('slice5 packs — sizes (feature-02 B)', () => {
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
});

describe('slice5 packs — roll by type (GDD §9.3)', () => {
  it('Sticker (joker) pack offers not-owned jokers to choose', () => {
    const offer = rollPack(slot('joker'), run(), makeRng('e'));
    expect(offer.type).toBe('joker');
    expect(offer.options.length).toBeLessThanOrEqual(BALANCE.pack.size.normal.show);
    for (const o of offer.options) expect(o.kind).toBe('joker');
  });

  it('Type (tile) pack shows letter tiles for the bag', () => {
    const offer = rollPack(slot('tile'), run(), makeRng('l'));
    for (const o of offer.options) {
      expect(o.kind).toBe('tile');
      if (o.kind === 'tile') expect(o.tile.letter).toMatch(/^[A-Z]$/);
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

  it('Forbidden Stacks pack offers forbidden items', () => {
    const offer = rollPack(slot('forbidden'), run(), makeRng('f'));
    for (const o of offer.options) expect(o.kind).toBe('forbidden');
  });

  it('is deterministic per seed', () => {
    expect(rollPack(slot('tile'), run(), makeRng('s'))).toEqual(rollPack(slot('tile'), run(), makeRng('s')));
  });
});

describe('slice5 packs — apply a pick', () => {
  it('a joker pick is added to the run', () => {
    const offer = rollPack(slot('joker'), run(), makeRng('e'));
    const r = applyPackPick(run(), offer.options[0]!);
    expect(r.jokers.length).toBe(1);
  });

  it('a tile pick is added to the bag', () => {
    const offer = rollPack(slot('tile'), run(), makeRng('l'));
    const before = run().bag.length;
    const r = applyPackPick(run(), offer.options[0]!);
    expect(r.bag.length).toBe(before + 1);
  });

  it('a punctuation pick levels its mapped pattern immediately (no slot used)', () => {
    const offer = rollPack(slot('pattern'), run(), makeRng('p'));
    const opt = offer.options[0]!;
    if (opt.kind !== 'punctuation') throw new Error('expected punctuation');
    const before = run().patternLevels[opt.pattern];
    const r = applyPackPick(run(), opt);
    expect(r.patternLevels[opt.pattern]).toBe(before + 1);
    expect(r.consumables.length).toBe(0); // did not occupy a consumable slot
  });

  it('a consumable pick respects consumable slots', () => {
    const offer = rollPack(slot('consumable'), run(), makeRng('c'));
    const full = run({ consumables: ['magnifier', 'magnifier'] }); // slots = 2
    expect(applyPackPick(full, offer.options[0]!).consumables.length).toBe(2); // no room → unchanged
  });

  it('a forbidden pick occupies a consumable slot (placeholder effect)', () => {
    const offer = rollPack(slot('forbidden'), run(), makeRng('f'));
    const r = applyPackPick(run(), offer.options[0]!);
    expect(r.consumables.length).toBe(1);
  });
});

describe('slice5 — Type packs stock all 7 non-base materials (GDD §9.3)', () => {
  it('can roll every material across many seeds, and stone tiles are letterless', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const r = { ...newRun(`pk${i}`), bag: [] };
      const offer = rollPack(slot('tile', 'mega'), r, makeRng(`pk${i}`));
      for (const o of offer.options) {
        if (o.kind !== 'tile') continue;
        seen.add(o.tile.material);
        // The invariant that makes Stone work (GDD §2.2)
        if (o.tile.material === 'stone') expect(o.tile.letter).toBeNull();
        else expect(o.tile.letter).not.toBeNull();
      }
    }
    for (const m of ['porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass']) {
      expect(seen.has(m)).toBe(true);
    }
  });
});
