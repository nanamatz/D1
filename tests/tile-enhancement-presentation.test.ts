import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Tile } from '../src/engine/types';
import { previewGamblerTile } from '../src/engine/gamblers';
import { changedTileAxes } from '../src/ui/game';

const tile = (overrides: Partial<Tile> = {}): Tile => ({
  id: 'tile',
  letter: 'A',
  material: 'ceramic',
  font: 'medium',
  edition: 'base',
  ...overrides,
});
const legacyTile = (): Tile => ({
  id: 'tile',
  letter: 'A',
  material: 'ceramic',
  font: 'medium',
});

describe('tile enhancement presentation', () => {
  it('reports each changed axis once and treats a missing edition as base', () => {
    expect(changedTileAxes(
      legacyTile(),
      tile({ material: 'wood', font: 'black', edition: 'rainbow' }),
    )).toEqual(['material', 'font', 'edition']);
    expect(changedTileAxes(legacyTile(), tile())).toEqual([]);
  });

  it('previews a Gambler font replacement without touching the other axes', () => {
    const original = tile({ material: 'wood', edition: 'gray' });
    expect(previewGamblerTile('geese', original)).toEqual({
      ...original,
      font: 'bold',
    });
  });

  it('keeps the inherited tile colour when Inline changes only the font axis', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../src/ui/styles/play.css', import.meta.url)),
      'utf8',
    );
    const inline = css.slice(css.indexOf('.tile.f-inline'), css.indexOf('/* ---------- staged', css.indexOf('.tile.f-inline')));
    expect(inline).toContain('-webkit-text-stroke: 2px currentColor');
    expect(inline).toContain('-webkit-text-fill-color: transparent');
    expect(inline).not.toMatch(/^\s*color:\s*transparent/m);
    expect(inline).not.toContain('var(--tile-ink)');
  });

  it('colours letter editions beneath material texture and omits White', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../src/ui/styles/play.css', import.meta.url)),
      'utf8',
    );

    expect(css).toContain('.tile-edition-gray');
    expect(css).toContain('.tile-edition-violet');
    expect(css).toContain('.tile-edition-rainbow');
    expect(css).toContain('mix-blend-mode: color');
    expect(css).not.toContain('.tile-edition-white');
  });

  it('gives Gray, Polished, and Void G persistent high-contrast identities', () => {
    const tileView = readFileSync(
      fileURLToPath(new URL('../src/ui/components/Tile.tsx', import.meta.url)),
      'utf8',
    );
    const css = readFileSync(
      fileURLToPath(new URL('../src/ui/styles/play.css', import.meta.url)),
      'utf8',
    );

    expect(css).toMatch(
      /\.tile-edition-gray\s*\{[^}]*mix-blend-mode:\s*normal[^}]*border:\s*3px[^}]*repeating-linear-gradient/s,
    );
    expect(css).toMatch(/\.tile\.edition-gray:not\(\.stone\)[\s\S]*color:\s*var\(--tile-ink-light/);
    expect(css).toMatch(
      /\.tile\.polished \.tile-material-texture\s*\{[^}]*border:\s*2px[^}]*box-shadow:/s,
    );
    expect(tileView).toContain('className="tile-letter" data-letter={tileGlyph(tile)}');
    expect(css).toMatch(
      /\.tile\.f-bold \.tile-letter\[data-letter='G'\]::after\s*\{[^}]*border-top:[^}]*border-right:/s,
    );
  });
});
