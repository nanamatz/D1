import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PACK_ART, packArt, hasPackArt, packGalleryPages } from '../src/ui/packArt';
import { BALANCE } from '../src/engine/balance';
import type { PackSize, PackType } from '../src/engine/types';

const SIZES: PackSize[] = ['normal', 'jumbo', 'mega'];
const ART_TYPES: PackType[] = ['tile', 'joker', 'consumable', 'pattern'];

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

  it('the art-backed types report hasPackArt true', () => {
    for (const type of ART_TYPES) expect(hasPackArt(type)).toBe(true);
  });

  it('ships all 32 runtime artworks as Star-Pack-sized path-only SVGs', () => {
    const directory = fileURLToPath(
      new URL('../src/ui/assets/packs/', import.meta.url),
    );
    const files = readdirSync(directory);
    const svgFiles = files.filter((file) => file.endsWith('.svg'));
    expect(svgFiles).toHaveLength(32);
    expect(files.some((file) => file.endsWith('.png'))).toBe(false);

    for (const file of svgFiles) {
      const svg = readFileSync(`${directory}/${file}`, 'utf8');
      expect(svg).toContain('width="244" height="400"');
      expect(svg).toContain('viewBox="0 0 122 200"');
      expect(svg).toContain('32-color path trace');
      expect(svg).toContain('stretch fit');
      expect(svg).toContain('<path ');
      expect(svg).not.toMatch(/<image|data:image|\.png/);
    }
  });
});

describe('packGalleryPages — Collection pack gallery', () => {
  it('has image-only pages for tile, charm, Fable, constellation, and Ink art', () => {
    const pages = packGalleryPages();
    expect(pages).toHaveLength(5);
    expect(pages.map((page) => page[0]!.family)).toEqual([
      'tile',
      'joker',
      'consumable',
      'pattern',
      'ink',
    ]);
  });

  it('each runtime art page lists variants in Basic→Classic→Premium order', () => {
    const pages = packGalleryPages();
    for (const type of ART_TYPES) {
      const page = pages.find((p) => p[0]!.family === type)!;
      const total = SIZES.reduce((n, s) => n + PACK_ART[type]![s].length, 0);
      expect(page.length).toBe(total);
      const srcs = page.map((e) => e.src);
      expect(srcs).toEqual([...PACK_ART[type]!.normal, ...PACK_ART[type]!.jumbo, ...PACK_ART[type]!.mega]);
    }
  });

  it('shows all 32 supplied images: tile 8, charm 4, Fable 8, constellation 8, Ink 4', () => {
    const pages = packGalleryPages();
    expect(pages.map((page) => page.length)).toEqual([8, 4, 8, 8, 4]);
    expect(pages.flat()).toHaveLength(32);
  });

  it('renders motion-enabled images with tooltips but no persistent labels', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/ui/components/Collection.tsx', import.meta.url)),
      'utf8',
    );
    const packsView = source.slice(
      source.indexOf('function PacksView()'),
      source.indexOf('// ---------- Palette'),
    );
    expect(packsView).toContain('<TiltCard');
    expect(packsView).toContain('idle');
    expect(packsView).toContain('className="pack-gallery-art"');
    expect(packsView).toContain('packTooltip(e.family, e.size, t)');
    expect(packsView).toContain('<Tooltip');
    expect(packsView).toContain('grade={tip.grade}');
    expect(packsView).not.toContain('className="cc-name"');
    expect(packsView).not.toContain('coming-soon-tag');
  });
});
