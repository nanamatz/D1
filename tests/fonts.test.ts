import { describe, it, expect } from 'vitest';
import { fontEffectOf, rollDiscardGains } from '../src/engine/fonts';
import { BALANCE } from '../src/engine/balance';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord, discardTiles } from '../src/engine/loop';
import { letterChips } from '../src/engine/scoring';
import { accumulate } from '../src/ui/settle';
import type { FontEffectId, Letter, Tile, TileFont } from '../src/engine/types';

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

const lex = makeLexicon(['cat'], {});
const fontFor = (effect: FontEffectId): TileFont =>
  (Object.keys(BALANCE.fontEffects) as (keyof typeof BALANCE.fontEffects)[])
    .find((f) => BALANCE.fontEffects[f] === effect)!;

let wc = 0;
const wordTiles = (word: string, fonts: Partial<Record<number, TileFont>> = {}): Tile[] =>
  [...word.toUpperCase()].map((ch, i) => ({
    id: `w${wc++}-${i}`, letter: ch as Letter, case: 'upper',
    material: 'ceramic', font: fonts[i] ?? 'medium',
  }));

const submit = (hand: Tile[]) => {
  const run = { ...newRun('font-seed'), bag: hand };
  const blind = startBlind(run, makeRng('font-seed'));
  return submitWord(blind, run, lex, blind.hand.map((t) => t.id), makeRng('f'));
};

describe('font play effects in the scoring pipeline (GDD §2.3)', () => {
  it('chipPlay adds its chips via a font ScoreEvent on the tile', () => {
    const hand = wordTiles('cat', { 1: fontFor('chipPlay') }); // A carries chipPlay
    const r = submit(hand);
    const fontEvents = r.events.filter((e) => e.kind === 'font');
    expect(fontEvents).toEqual([
      expect.objectContaining({
        effect: 'chipPlay', tileId: hand[1]!.id,
        chipsDelta: BALANCE.fontEffectValues.chipPlay.chips, multDelta: 0, goldDelta: 0,
      }),
    ]);
    // CAT = 5 letter chips + 30 → settle sees 35 × 1.0 standard
    expect(r.submission.settledScore).toBe(35);
  });

  it('goldPlay pays gold through SubmitResult.goldDelta and logs a font event', () => {
    const r = submit(wordTiles('cat', { 0: fontFor('goldPlay') }));
    expect(r.goldDelta).toBe(BALANCE.fontEffectValues.goldPlay.gold);
    expect(r.events).toContainEqual(
      expect.objectContaining({
        kind: 'font', effect: 'goldPlay',
        goldDelta: BALANCE.fontEffectValues.goldPlay.gold, chipsDelta: 0,
      }),
    );
    expect(r.submission.settledScore).toBe(5); // gold never touches chips×mult
  });

  it('retriggerPlay repeats the tile scoring block once', () => {
    const hand = wordTiles('cat', { 2: fontFor('retriggerPlay') }); // T retriggers
    const r = submit(hand);
    const tId = hand[2]!.id;
    expect(r.events.filter((e) => e.kind === 'tile' && e.tileId === tId)).toHaveLength(2);
    expect(r.events.filter((e) => e.kind === 'font' && e.effect === 'retriggerPlay')).toHaveLength(1);
    // C3 A1 T1 + retriggered T1 = 6 chips × 1.0
    expect(r.submission.settledScore).toBe(6);
  });

  it('retriggerPlay re-fires the tile material too (retriggers compose)', () => {
    const hand = wordTiles('cat', { 2: fontFor('retriggerPlay') });
    hand[2]!.material = 'porcelain';
    const r = submit(hand);
    const matEvents = r.events.filter((e) => e.kind === 'material' && e.tileId === hand[2]!.id);
    expect(matEvents).toHaveLength(2);
    // 5 letter chips + T again (1) + 2×30 porcelain = 66 × 1.0
    expect(r.submission.settledScore).toBe(66);
  });

  it('font play effects fire on gibberish too (GDD §2.3 rule)', () => {
    const r = submit(wordTiles('tac', { 0: fontFor('chipPlay') })); // not in lexicon
    expect(r.submission.isGibberish).toBe(true);
    expect(r.events.some((e) => e.kind === 'font' && e.effect === 'chipPlay')).toBe(true);
  });
});

describe('settle replay: accumulate folds font events (GDD §2.3)', () => {
  it('accumulate folds font chipsDelta like other delta events', () => {
    const r = accumulate(10, 2, {
      kind: 'font', font: 'bold', effect: 'chipPlay', tileId: 'x',
      chipsDelta: 30, multDelta: 0, goldDelta: 0,
    });
    expect(r).toEqual({ chips: 40, mult: 2 });
  });
});

describe('discardGain wired into discardTiles (GDD §2.3)', () => {
  it('discarding a discardGain tile yields a consumable via discardTiles', () => {
    const run = newRun('discard-seed'); // consumableSlots 2, consumables []
    const blind = startBlind(run, makeRng('discard-seed'));
    const discardTile: Tile = { ...blind.hand[0]!, font: fontFor('discardGain') };
    const seeded = { ...blind, hand: [discardTile, ...blind.hand.slice(1)] };

    const { blind: after, gained, slotsBlocked } = discardTiles(
      seeded, run, [discardTile.id], makeRng('d'),
    );
    expect(gained).toHaveLength(1);
    expect(slotsBlocked).toBe(0);
    expect(after.discardsLeft).toBe(seeded.discardsLeft - 1);
  });

  it('discardTiles with full slots yields nothing and reports slotsBlocked', () => {
    const base = newRun('discard-seed-2');
    const run = { ...base, consumables: Array(base.consumableSlots).fill('magnifier' as const) };
    const blind = startBlind(run, makeRng('discard-seed-2'));
    const discardTile: Tile = { ...blind.hand[0]!, font: fontFor('discardGain') };
    const seeded = { ...blind, hand: [discardTile, ...blind.hand.slice(1)] };

    const { gained, slotsBlocked } = discardTiles(seeded, run, [discardTile.id], makeRng('d'));
    expect(gained).toHaveLength(0);
    expect(slotsBlocked).toBe(1);
  });
});
