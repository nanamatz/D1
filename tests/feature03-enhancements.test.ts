/**
 * feature-03 A — enhancement effects must fire and change the scored total.
 *
 * Regression net for the "materials/fonts/editions do nothing in play" class of
 * bug. Each axis (material / font / edition) is asserted to change settledScore
 * through the FULL submitWord pipeline, the confirmed GDD §2.3 font mapping is
 * locked, and GDD §2.4 three-axis stacking is verified to pay all three at once.
 */
import { describe, it, expect } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { makeLexicon } from '../src/engine/lexicon';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { startBlind, submitWord } from '../src/engine/loop';
import type { Letter, Tile, TileEdition, TileFont, TileMaterial } from '../src/engine/types';

const lex = makeLexicon(['cat'], {});

let idc = 0;
const wordTiles = (
  word: string,
  enh: Partial<Record<number, Partial<Pick<Tile, 'material' | 'font' | 'edition'>>>> = {},
): Tile[] =>
  [...word.toUpperCase()].map((ch, i) => ({
    id: `f3-${idc++}`,
    letter: ch as Letter,
    material: (enh[i]?.material ?? 'ceramic') as TileMaterial,
    font: (enh[i]?.font ?? 'medium') as TileFont,
    edition: (enh[i]?.edition ?? 'base') as TileEdition,
  }));

const submit = (hand: Tile[]) => {
  const run = { ...newRun('f3-seed'), bag: hand };
  const blind = startBlind(run, makeRng('f3-seed'));
  return submitWord(blind, run, lex, blind.hand.map((t) => t.id), makeRng('f3'));
};

const PLAIN = 15; // CAT = C9 + A3 + T3, standard ×1.0

describe('feature-03 A — the confirmed GDD §2.3 font mapping', () => {
  it('maps each font to its confirmed effect (Inline=discardGain, Black=retriggerPlay)', () => {
    expect(BALANCE.fontEffects).toMatchObject({
      lightItalic: 'goldPlay',
      bold: 'chipPlay',
      inline: 'discardGain',
      black: 'retriggerPlay',
    });
  });
});

describe('feature-03 A — each axis changes the scored total (full pipeline)', () => {
  it('material: a Ceramic (porcelain) tile adds its chips', () => {
    const r = submit(wordTiles('cat', { 0: { material: 'porcelain' } }));
    expect(r.submission.settledScore).toBe(PLAIN + BALANCE.materials.porcelain.chips);
  });

  it('font: a chipPlay Underline tile (internal bold id) adds its chips', () => {
    const r = submit(wordTiles('cat', { 0: { font: 'bold' } }));
    expect(r.submission.settledScore).toBe(PLAIN + BALANCE.fontEffectValues.chipPlay.chips);
  });

  it('font: a retriggerPlay (Black) tile repeats its scoring when PLAYED (not silent)', () => {
    // Black must fire on play. Under the pre-fix swap it mapped to discardGain and
    // did nothing when played — this asserts it now retriggers the C tile (+9).
    const r = submit(wordTiles('cat', { 0: { font: 'black' } }));
    expect(r.submission.settledScore).toBe(PLAIN + BALANCE.letterChips.C!);
    expect(r.events.filter((e) => e.kind === 'font' && e.effect === 'retriggerPlay')).toHaveLength(1);
  });

  it('edition: a Gray tile adds its chips', () => {
    const r = submit(wordTiles('cat', { 0: { edition: 'gray' } }));
    expect(r.submission.settledScore).toBe(PLAIN + BALANCE.edition.grayChips);
  });
});

describe('feature-03 A — GDD §2.4 three axes stack on one tile', () => {
  it('a Porcelain + Underline(chipPlay) + Gray tile pays all three at once', () => {
    const r = submit(wordTiles('cat', { 0: { material: 'porcelain', font: 'bold', edition: 'gray' } }));
    expect(r.submission.settledScore).toBe(
      PLAIN +
        BALANCE.materials.porcelain.chips +
        BALANCE.fontEffectValues.chipPlay.chips +
        BALANCE.edition.grayChips,
    );
  });
});
