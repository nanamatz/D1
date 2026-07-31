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
});
