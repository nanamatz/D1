import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import {
  FABLE_DEFS,
  FABLE_IDS,
  canUseFable,
  canUseUnheldFable,
  fablePickCount,
  fableTargetsTiles,
  useFable,
  useFableOnPouch,
} from '../src/engine/fables';
import { applyTileMaterial } from '../src/engine/materials';
import { startBlind } from '../src/engine/loop';
import { makeRng, type Rng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { ALL_JOKERS } from '../src/engine/jokers';
import type { BlindState, RunState, Tile } from '../src/engine/types';

const zeroRng: Rng = {
  next: () => 0,
  int: () => 0,
  shuffle: <T>(items: readonly T[]) => items.slice(),
};
const highRng: Rng = {
  next: () => 0.99,
  int: () => 0,
  shuffle: <T>(items: readonly T[]) => items.slice(),
};

function setup(id: (typeof FABLE_IDS)[number]): { run: RunState; blind: BlindState } {
  const run = { ...newRun('fables'), consumables: [id] };
  return { run, blind: startBlind(run, makeRng('fables-blind')) };
}

describe('Fable registry', () => {
  it('contains all 18 ordered cards', () => {
    expect(FABLE_DEFS).toHaveLength(18);
    expect(FABLE_DEFS.map((def) => def.number)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
  });

  it('accepts one through the listed maximum for targeted enhancements', () => {
    const { run, blind } = setup('fable4');
    expect(canUseFable('fable4', run, blind, [blind.hand[0]!.id])).toBe(true);
    expect(canUseFable('fable4', run, blind, blind.hand.slice(0, 2).map((t) => t.id))).toBe(true);
    expect(canUseFable('fable4', run, blind, blind.hand.slice(0, 3).map((t) => t.id))).toBe(false);
  });

  it('enhances selected tiles in both the live blind and permanent pouch', () => {
    const { run, blind } = setup('fable4');
    const ids = blind.hand.slice(0, 2).map((tile) => tile.id);
    const result = useFable('fable4', run, blind, ids, zeroRng);
    expect(result.ok).toBe(true);
    expect(result.blind.hand.filter((tile) => ids.includes(tile.id)).every((tile) => tile.material === 'leadPlate')).toBe(true);
    expect(result.run.bag.filter((tile) => ids.includes(tile.id)).every((tile) => tile.material === 'leadPlate')).toBe(true);
  });

  it('Stone hides and remembers the selected tile letter', () => {
    const { run, blind } = setup('fable5');
    const tile = blind.hand.find((candidate) => candidate.letter !== null)!;
    const result = useFable('fable5', run, blind, [tile.id], zeroRng);
    const stone = result.blind.hand.find((candidate) => candidate.id === tile.id)!;
    expect(stone.material).toBe('stone');
    expect(stone.letter).toBeNull();
    expect(stone.letterBeforeStone).toBe(tile.letter);
  });

  it('Wood begins at +15 Chips and requests one +10 growth per play', () => {
    const tile: Tile = {
      id: 'wood',
      letter: 'A',
      material: 'wood',
      font: 'medium',
      woodBonusChips: BALANCE.materials.wood.baseChips,
    };
    const ctx = {
      submission: { tiles: [tile], text: 'A', isGibberish: true, suit: null, posUsed: null, settledScore: 0 },
      chips: 0,
      mult: 1,
    };
    const applied = applyTileMaterial(ctx, tile, zeroRng);
    expect(applied?.chipsDelta).toBe(15);
    expect(applied?.side.growWood).toBe(true);
  });

  it('doubles current gold with a maximum gain of $20', () => {
    const base = setup('fable9');
    const low = useFable('fable9', { ...base.run, gold: 7 }, base.blind, [], zeroRng);
    expect(low.run.gold).toBe(14);
    const high = setup('fable9');
    expect(useFable('fable9', { ...high.run, gold: 50 }, high.blind, [], zeroRng).run.gold).toBe(70);
  });

  it('creates up to two random cards using the slots freed by consuming itself', () => {
    const { run, blind } = setup('fable3');
    const result = useFable('fable3', run, blind, [], zeroRng);
    expect(result.run.consumables).toEqual(['fable1', 'fable1']);
  });

  it('creates Constellation cards in available consumable slots', () => {
    const { run, blind } = setup('fable10');
    const result = useFable('fable10', run, blind, [], zeroRng);
    expect(result.run.consumables).toEqual(['libra', 'libra']);
  });

  it('copies the last Fable or Constellation card', () => {
    const { run, blind } = setup('fable2');
    const result = useFable(
      'fable2',
      { ...run, lastFableOrConstellation: 'virgo' },
      blind,
      [],
      zeroRng,
    );
    expect(result.run.consumables).toEqual(['virgo']);
    expect(result.run.lastFableOrConstellation).toBe('virgo');
  });

  it('disables an unheld Boy Who Cried Wolf until this run has a card to copy', () => {
    const { run, blind } = setup('fable2');
    const offeredRun = { ...run, consumables: [] };
    expect(canUseUnheldFable('fable2', offeredRun, blind)).toBe(false);
    expect(canUseUnheldFable(
      'fable2',
      { ...offeredRun, lastFableOrConstellation: 'virgo' },
      blind,
    )).toBe(true);
  });

  it('advances alphabet ranks and wraps Z to A', () => {
    const { run, blind } = setup('fable16');
    const targets = blind.hand.slice(0, 2);
    const letters = new Map([[targets[0]!.id, 'A'], [targets[1]!.id, 'Z']] as const);
    const patch = (tile: Tile): Tile =>
      letters.has(tile.id) ? { ...tile, letter: letters.get(tile.id)! } : tile;
    const preparedRun = { ...run, bag: run.bag.map(patch) };
    const preparedBlind = { ...blind, hand: blind.hand.map(patch) };
    const result = useFable('fable16', preparedRun, preparedBlind, targets.map((t) => t.id), zeroRng);
    const changed = result.blind.hand.filter((tile) => letters.has(tile.id)).map((tile) => tile.letter);
    expect(changed).toEqual(['B', 'A']);
  });

  it('does not consume the edition card without an eligible Charm', () => {
    const { run, blind } = setup('fable15');
    expect(canUseFable('fable15', run, blind, [])).toBe(false);
    expect(useFable('fable15', run, blind, [], zeroRng).run.consumables).toEqual(['fable15']);
  });

  it('creates a Charm only when capacity exists and can edition an eligible Charm', () => {
    const create = setup('fable14');
    const withCharm = useFable('fable14', create.run, create.blind, [], zeroRng);
    expect(withCharm.run.jokers).toHaveLength(1);
    expect(withCharm.run.jokers[0]?.edition).toBe('base');

    const edition = setup('fable15');
    const editioned = useFable(
      'fable15',
      { ...edition.run, jokers: [{ defId: 'carteBlanche', edition: 'base', state: {} }] },
      edition.blind,
      [],
      zeroRng,
    );
    expect(editioned.run.jokers[0]?.edition).toBe('gray');
    expect(editioned.chanceResults).toEqual([{
      chance: BALANCE.fables.cowherdEditionChance,
      label: 'edition',
      outcome: 'success',
    }]);

    const missed = useFable(
      'fable15',
      { ...edition.run, jokers: [{ defId: 'carteBlanche', edition: 'base', state: {} }] },
      edition.blind,
      [],
      highRng,
    );
    expect(missed.run.jokers[0]?.edition).toBe('base');
    expect(missed.chanceResults[0]?.outcome).toBe('failure');
  });

  it('creates only an unowned Charm by default; Copy Editor reopens duplicates', () => {
    const create = setup('fable14');
    const owned = {
      ...create.run,
      jokerSlots: ALL_JOKERS.length + 1,
      jokers: [{ defId: ALL_JOKERS[0]!.id, edition: 'base' as const, state: {} }],
    };
    const result = useFable('fable14', owned, create.blind, [], zeroRng);
    const ids = result.run.jokers.map((joker) => joker.defId);
    expect(new Set(ids).size).toBe(ids.length);

    const exhausted = {
      ...create.run,
      jokerSlots: ALL_JOKERS.length + 1,
      jokers: ALL_JOKERS.map((def) => ({ defId: def.id, edition: 'base' as const, state: {} })),
    };
    expect(canUseFable('fable14', exhausted, create.blind, [])).toBe(true);
    const duplicated = useFable('fable14', exhausted, create.blind, [], zeroRng);
    expect(duplicated.run.jokers).toHaveLength(exhausted.jokers.length + 1);
  });

  it('grants total Charm sell value with a $50 cap', () => {
    const { run, blind } = setup('fable17');
    const result = useFable(
      'fable17',
      {
        ...run,
        gold: 3,
        jokers: Array.from({ length: 10 }, () => ({ defId: 'hypocrite', state: {} })),
      },
      blind,
      [],
      zeroRng,
    );
    expect(result.run.gold).toBeLessThanOrEqual(53);
    expect(result.run.gold).toBeGreaterThan(3);
  });

  it('a same-axis overwrite just replaces the material — no confirm (GDD §2.4 revised)', () => {
    const { run, blind } = setup('fable6'); // polished material fable
    const ids = blind.hand.slice(0, 2).map((t) => t.id);
    // both targets already Porcelain; applying Polished replaces it silently.
    const enhanced = {
      ...blind,
      hand: blind.hand.map((t, i) => (i < 2 ? { ...t, material: 'porcelain' as const } : t)),
    };
    const result = useFable('fable6', run, enhanced, ids, zeroRng);
    expect(result.ok).toBe(true);
    expect(result.blind.hand.filter((t) => ids.includes(t.id)).every((t) => t.material === 'polished')).toBe(true);
  });

  it('applies a tile Fable to dealt POUCH candidates by id (Fable Pack path)', () => {
    const base = newRun('pouch');
    const run = { ...base, consumables: ['fable6' as const] }; // Polished ×2
    expect(fableTargetsTiles('fable6')).toBe(true);
    expect(fablePickCount('fable6')).toEqual({ min: 1, max: 2 });
    const ids = run.bag.slice(0, 2).map((t) => t.id);
    const { ok, run: after } = useFableOnPouch('fable6', run, ids);
    expect(ok).toBe(true);
    expect(after.bag.filter((t) => ids.includes(t.id)).every((t) => t.material === 'polished')).toBe(true);
    expect(after.consumables).toEqual([]); // the card was consumed
  });

  it('accepts one pouch target when the listed maximum is two', () => {
    const run = { ...newRun('pouch2'), consumables: ['fable6' as const] };
    const one = run.bag.slice(0, 1).map((t) => t.id);
    expect(useFableOnPouch('fable6', run, one).ok).toBe(true);
  });

  it('destroys up to two selected tiles from the live blind and permanent pouch', () => {
    const { run, blind } = setup('fable18');
    const ids = blind.hand.slice(0, 2).map((tile) => tile.id);
    const result = useFable('fable18', run, blind, ids, zeroRng);
    expect(result.run.bag.some((tile) => ids.includes(tile.id))).toBe(false);
    expect(result.blind.hand.some((tile) => ids.includes(tile.id))).toBe(false);
  });
});
