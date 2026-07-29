import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Emoji Tile collection grid', () => {
  it('pages 15 cards into five fixed runtime-size columns', () => {
    const component = source('src/ui/components/Collection.tsx');
    const css = source('src/ui/styles/screens.css');
    const play = source('src/ui/styles/play.css');

    expect(component).toContain('const JOKERS_PER_PAGE = 15;');
    expect(component).toContain('className="card-grid joker-collection-grid"');
    expect(css).toMatch(
      /\.joker-collection-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*var\(--shop-card-w\)\)/s,
    );
    expect(play).toMatch(
      /\.overlay-card\.pause-modal:has\(\.detail-jokers\)\s*\{[^}]*overflow-y:\s*clip;/s,
    );
  });
});
