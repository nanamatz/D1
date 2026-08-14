import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Emoji Tile collection grid', () => {
  it('pages 15 cards into five fixed runtime-size columns', () => {
    const component = source('src/ui/components/Collection.tsx');
    const css = source('src/ui/styles/screens.css');
    const options = source('src/ui/components/Options.tsx');
    const screens = source('src/ui/styles/screens.css');

    expect(component).toContain('const JOKERS_PER_PAGE = 15;');
    expect(component).toContain('className="card-grid joker-collection-grid"');
    expect(component).toContain("t('collection.joker.undiscovered')");
    expect(component).toContain("t('collection.joker.undiscoveredHint')");
    expect(component).toContain('className="emoji-tile-lock"');
    expect(component).toContain('className="joker-record-sticker"');
    expect(component).toContain('src={recordArt(sticker)}');
    expect(component).toContain("t('collection.joker.recordStickerDesc'");
    expect(component).not.toContain("t('joker.unlockCondition'");
    expect(css).toMatch(/\.emoji-tile-collection\.locked \.cc-joker-art\s*\{[^}]*opacity:\s*0/s);
    expect(css).toMatch(
      /\.joker-record-sticker\s*\{[^}]*position:\s*absolute[^}]*right:\s*-9px/s,
    );
    expect(css).toMatch(
      /\.joker-collection-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*var\(--shop-card-w\)\)/s,
    );
    expect(options).toContain('className="overlay collection-overlay"');
    expect(options).toContain('document.body');
    expect(screens).toMatch(/\.collection-overlay\s*\{[^}]*overflow:\s*hidden/s);
  });
});
