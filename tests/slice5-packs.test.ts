import { describe, it, expect } from 'vitest';
import { rollPack, applyPackPick } from '../src/engine/packs';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';
import { BALANCE } from '../src/engine/balance';
import type { RunState } from '../src/engine/types';

const run = (over: Partial<RunState> = {}): RunState => ({ ...newRun('pack'), ...over });

describe('slice5 packs — roll (GDD §9.3)', () => {
  it('Emoji Pack offers not-owned jokers to choose 1', () => {
    const offer = rollPack('emoji', run(), makeRng('e'));
    expect(offer.kind).toBe('emoji');
    expect(offer.pick).toBe(BALANCE.pack.emoji.pick);
    expect(offer.options.length).toBeLessThanOrEqual(BALANCE.pack.emoji.show);
    for (const o of offer.options) expect(o.kind).toBe('joker');
  });

  it('Letter Pack shows tiles to add to the bag, choose up to 2', () => {
    const offer = rollPack('letter', run(), makeRng('l'));
    expect(offer.pick).toBe(2);
    expect(offer.options.length).toBe(BALANCE.pack.letter.show);
    for (const o of offer.options) {
      expect(o.kind).toBe('tile');
      if (o.kind === 'tile') expect(o.tile.letter).toMatch(/^[A-Z]$/);
    }
  });

  it('is deterministic per seed', () => {
    expect(rollPack('letter', run(), makeRng('s'))).toEqual(rollPack('letter', run(), makeRng('s')));
  });
});

describe('slice5 packs — apply a pick', () => {
  it('a joker pick is added to the run', () => {
    const offer = rollPack('emoji', run(), makeRng('e'));
    const r = applyPackPick(run(), offer.options[0]!);
    expect(r.jokers.length).toBe(1);
  });

  it('a tile pick is added to the bag', () => {
    const offer = rollPack('letter', run(), makeRng('l'));
    const before = run().bag.length;
    const r = applyPackPick(run(), offer.options[0]!);
    expect(r.bag.length).toBe(before + 1);
  });

  it('a consumable pick respects consumable slots', () => {
    const offer = rollPack('consumable', run(), makeRng('c'));
    const full = run({ consumables: ['magnifier', 'magnifier'] }); // slots = 2
    expect(applyPackPick(full, offer.options[0]!).consumables.length).toBe(2); // no room → unchanged
  });
});
