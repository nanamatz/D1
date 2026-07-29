import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('feedback 3 UI regressions', () => {
  it('commits transformed Fable candidates before removing their preview', () => {
    const game = source('src/ui/useGame.ts');
    const pack = source('src/ui/components/PackOpening.tsx');
    expect(game).toContain('const bagTiles = new Map(run.bag.map');
    expect(game).toContain('candidateTiles,');
    expect(pack).toMatch(/resolvePick\(\);\s*\/\/ The committed candidate state[\s\S]*setFableFx\(null\)/);
  });

  it('fits Tile Pack choices to the tile image', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const css = source('src/ui/styles/play.css');
    expect(pack).toContain("option.kind === 'tile' && 'tile-pack-option'");
    expect(css).toMatch(
      /\.pack-option-card\.tile-pack-option\s*\{[^}]*aspect-ratio:\s*1/s,
    );
  });

  it('keeps mascot hover and tooltips outside a non-scrolling row', () => {
    const collection = source('src/ui/components/Collection.tsx');
    const css = source('src/ui/styles/screens.css');
    expect(collection).toMatch(/<Tooltip[\s\S]*collection\.mascot\.tooltip/);
    expect(css).toMatch(
      /\.mascot-collection \.mascot-card-row\s*\{[^}]*overflow:\s*visible/s,
    );
    expect(css).not.toMatch(
      /\.mascot-collection \.mascot-card-row\s*\{[^}]*overflow-x:\s*auto/s,
    );
  });

  it('preloads only first-interaction art', () => {
    const loading = source('src/ui/components/LoadingScreen.tsx');
    expect(loading).not.toContain('import.meta.glob');
    expect(loading).toContain("const ASSET_URLS = [mascotSrc('woodak'), pouchUrl, draftUrl]");
  });
});
