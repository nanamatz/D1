import { describe, it, expect } from 'vitest';
import { fontEffectOf, rollDiscardGains } from '../src/engine/fonts';
import { BALANCE } from '../src/engine/balance';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Tile, TileFont } from '../src/engine/types';

const tile = (font: TileFont, id = `t-${font}`): Tile => ({
  id, letter: 'A', case: 'upper', material: 'ceramic', font,
});

describe('font effect resolution (GDD §2.3)', () => {
  it('medium is the base font and has no effect', () => {
    expect(fontEffectOf('medium')).toBeNull();
  });

  it('every non-base font resolves to an effect from BALANCE.fontEffects', () => {
    for (const f of ['lightItalic', 'bold', 'inline', 'black'] as const) {
      expect(fontEffectOf(f)).toBe(BALANCE.fontEffects[f]);
    }
  });
});

describe('discardGain rolls (GDD §2.3 Purple-Seal port)', () => {
  const discardFont = (Object.keys(BALANCE.fontEffects) as (keyof typeof BALANCE.fontEffects)[])
    .find((f) => BALANCE.fontEffects[f] === 'discardGain')!;

  it('gains one random consumable per discardGain tile when slots are free', () => {
    const run = newRun('seed-fonts'); // consumableSlots 2, consumables []
    const { gained, slotsBlocked } = rollDiscardGains(
      run, [tile(discardFont, 'd1'), tile('medium', 'd2')], makeRng('x'),
    );
    expect(gained).toHaveLength(1);
    expect(slotsBlocked).toBe(0);
  });

  it('no-ops (counts slotsBlocked) when consumable slots are full', () => {
    const base = newRun('seed-fonts');
    const run = { ...base, consumables: Array(base.consumableSlots).fill('magnifier' as const) };
    const { gained, slotsBlocked } = rollDiscardGains(run, [tile(discardFont)], makeRng('x'));
    expect(gained).toHaveLength(0);
    expect(slotsBlocked).toBe(1);
  });

  it('partial fill: gains up to the free slots, blocks the rest', () => {
    const base = newRun('seed-fonts');
    const run = { ...base, consumables: Array(base.consumableSlots - 1).fill('magnifier' as const) };
    const { gained, slotsBlocked } = rollDiscardGains(
      run, [tile(discardFont, 'd1'), tile(discardFont, 'd2')], makeRng('x'),
    );
    expect(gained).toHaveLength(1);
    expect(slotsBlocked).toBe(1);
  });
});
