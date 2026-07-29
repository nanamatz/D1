import { describe, expect, it } from 'vitest';
import {
  canUseFableFromPack,
  useFableOnPouch,
} from '../src/engine/fables';
import { startBlind } from '../src/engine/loop';
import { newRun } from '../src/engine/run';
import { makeRng } from '../src/engine/rng';

const setup = () => {
  const run = newRun('fable-pack');
  const blind = startBlind(run, makeRng('fable-pack-blind'));
  return { run, blind };
};

describe('Fable Pack resolution', () => {
  it('uses Select semantics for blind-only cards and requires a held slot', () => {
    const { run, blind } = setup();
    expect(canUseFableFromPack('fable1', run, blind, [])).toBe(true);
    const full = {
      ...run,
      consumables: Array.from({ length: run.consumableSlots }, () => 'magnifier' as const),
    };
    expect(canUseFableFromPack('fable1', full, blind, [])).toBe(false);
  });

  it('accepts one through the listed maximum candidate count', () => {
    const { run, blind } = setup();
    const ids = run.bag.slice(0, 2).map((tile) => tile.id);
    expect(canUseFableFromPack('fable4', run, blind, [])).toBe(false);
    expect(canUseFableFromPack('fable4', run, blind, ids.slice(0, 1))).toBe(true);
    expect(canUseFableFromPack('fable4', run, blind, ids)).toBe(true);
  });

  it('keeps a non-tile Fable independent of candidate selection', () => {
    const { run, blind } = setup();
    expect(canUseFableFromPack('fable9', run, blind, [])).toBe(true);
    expect(canUseFableFromPack('fable9', run, blind, [run.bag[0]!.id])).toBe(true);
  });

  it('applies a targeted pack Fable immediately and consumes its temporary card', () => {
    const { run } = setup();
    const targets = run.bag.slice(0, 2);
    const staged = { ...run, consumables: [...run.consumables, 'fable4' as const] };
    const result = useFableOnPouch('fable4', staged, targets.map((tile) => tile.id));
    expect(result.ok).toBe(true);
    expect(result.run.consumables).not.toContain('fable4');
    expect(
      result.run.bag
        .filter((tile) => targets.some((target) => target.id === tile.id))
        .every((tile) => tile.material === 'leadPlate'),
    ).toBe(true);
  });
});
