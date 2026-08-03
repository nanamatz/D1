import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Tile } from '../src/engine/types';
import { TileView } from '../src/ui/components/Tile';
import { I18nProvider } from '../src/ui/i18n';

describe('face-down letter tiles', () => {
  it('hides every enhancement axis behind the same back', () => {
    const tile: Tile = {
      id: 'hidden-enhanced',
      letter: 'A',
      material: 'glass',
      font: 'black',
      edition: 'rainbow',
    };
    const markup = renderToStaticMarkup(createElement(
      I18nProvider,
      null,
      createElement(TileView, { tile, faceDown: true }),
    ));

    expect(markup).toContain('class="tile facedown"');
    expect(markup).toContain('class="tile-back"');
    expect(markup).not.toContain('glass');
    expect(markup).not.toContain('font-black');
    expect(markup).not.toContain('edition-rainbow');
    expect(markup).not.toContain('data-material');
  });
});
