import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Tile } from '../src/engine/types';
import { TileView } from '../src/ui/components/Tile';
import { I18nProvider } from '../src/ui/i18n';

const glass: Tile = {
  id: 'broken-glass',
  letter: 'A',
  material: 'glass',
  font: 'medium',
  edition: 'base',
};

describe('submitted Glass destruction presentation', () => {
  it('keeps a destroyed Glass tile visibly cracked and accessible', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider><TileView tile={glass} mini inspectable destroyed /></I18nProvider>,
    );
    expect(markup).toContain('glass-destroyed');
    expect(markup).toContain('class="glass-shatter-fx"');
    expect(markup).toContain('Destroyed');
  });

  it('lands the shatter and sound on the material timeline beat', () => {
    const settle = readFileSync('src/ui/settle.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    expect(settle).toContain('if (tileWasDestroyed(e)) destroyedTileIds.add(e.tileId)');
    expect(settle).toContain("if (tileWasDestroyed(e)) audio.play('matGlassBreak')");
    expect(css).toContain('.tile.glass-shattering');
    expect(css).toContain('@keyframes glass-shards');
  });
});
