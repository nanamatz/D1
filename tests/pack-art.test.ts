import { describe, it, expect } from 'vitest';
import { PACK_ART, packArt, hasPackArt, packGalleryPages } from '../src/ui/packArt';
import { BALANCE } from '../src/engine/balance';
import type { PackSize, PackType } from '../src/engine/types';

const SIZES: PackSize[] = ['normal', 'jumbo', 'mega'];
const ART_TYPES: PackType[] = ['tile', 'joker', 'pattern']; // consumable has no art yet

describe('packArt — (type, size) → art mapping', () => {
  it('the art count per (type, size) matches BALANCE.pack.artVariants', () => {
    for (const type of ART_TYPES) {
      for (const size of SIZES) {
        expect(PACK_ART[type]![size].length).toBe(BALANCE.pack.artVariants[type][size]);
      }
    }
  });

  it('returns a defined url for every art type/size/variant', () => {
    for (const type of ART_TYPES) {
      for (const size of SIZES) {
        for (let v = 0; v < BALANCE.pack.artVariants[type][size]; v++) {
          expect(packArt(type, size, v)).toBe(PACK_ART[type]![size][v]);
        }
      }
    }
  });

  it('wraps an out-of-range variant instead of returning undefined', () => {
    for (const type of ART_TYPES) {
      for (const size of SIZES) {
        const list = PACK_ART[type]![size];
        expect(packArt(type, size, list.length)).toBe(list[0]); // wraps to first
        expect(packArt(type, size, -1)).toBe(list[list.length - 1]); // negative → last
      }
    }
  });

  it('consumable has no art yet: packArt is null, hasPackArt is false', () => {
    expect(PACK_ART.consumable).toBeUndefined();
    expect(hasPackArt('consumable')).toBe(false);
    for (const size of SIZES) expect(packArt('consumable', size, 0)).toBeNull();
  });

  it('the art-backed types report hasPackArt true', () => {
    for (const type of ART_TYPES) expect(hasPackArt(type)).toBe(true);
  });
});

describe('packGalleryPages — 도감 Packs gallery (Reference.png)', () => {
  it('has one page per pack type, in tile → joker → pattern → consumable order', () => {
    const pages = packGalleryPages();
    expect(pages).toHaveLength(4);
    const firstTypeOf = (p: (typeof pages)[number]) => (p[0]!.kind === 'art' ? p[0]!.type : p[0]!.type);
    expect(pages.map(firstTypeOf)).toEqual(['tile', 'joker', 'pattern', 'consumable']);
  });

  it('each art page lists all that type\'s variants in Basic→Classic→Premium order', () => {
    const pages = packGalleryPages();
    for (const type of ART_TYPES) {
      const page = pages.find((p) => p[0]!.kind === 'art' && p[0]!.type === type)!;
      const total = SIZES.reduce((n, s) => n + PACK_ART[type]![s].length, 0);
      expect(page.length).toBe(total);
      expect(page.every((e) => e.kind === 'art')).toBe(true);
      const srcs = page.map((e) => (e.kind === 'art' ? e.src : null));
      expect(srcs).toEqual([...PACK_ART[type]!.normal, ...PACK_ART[type]!.jumbo, ...PACK_ART[type]!.mega]);
    }
  });

  it('tile page holds 7, joker 4, ink(pattern) 8', () => {
    const pages = packGalleryPages();
    const len = (type: PackType) => pages.find((p) => p[0]!.kind === 'art' && p[0]!.type === type)!.length;
    expect(len('tile')).toBe(7);
    expect(len('joker')).toBe(4);
    expect(len('pattern')).toBe(8);
  });

  it('consumable is a single coming-soon card (no art)', () => {
    const page = packGalleryPages()[3]!;
    expect(page).toHaveLength(1);
    expect(page[0]).toEqual({ kind: 'comingSoon', type: 'consumable' });
  });
});
