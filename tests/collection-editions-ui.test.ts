import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CATEGORY_COLUMNS, EDITIONS } from '../src/ui/components/Collection';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { SKIP_REWARD_IDS } from '../src/engine/skipRewards';

describe('Edition Collection page', () => {
  it('lists Base and every special Emoji Tile edition with localized names and effects', () => {
    expect(EDITIONS).toEqual(['base', 'gray', 'white', 'rainbow', 'violet']);
    for (const edition of EDITIONS) {
      expect(en).toHaveProperty(`edition.${edition}`);
      expect(en).toHaveProperty(`editiondesc.${edition}`);
      expect(ko).toHaveProperty(`edition.${edition}`);
      expect(ko).toHaveProperty(`editiondesc.${edition}`);
    }
  });

  it('keeps all five edition cards in one horizontal row', () => {
    const css = readFileSync(
      new URL('../src/ui/styles/screens.css', import.meta.url),
      'utf8',
    );
    expect(css).toMatch(
      /\.edition-collection-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*var\(--shop-card-w\)\);/s,
    );
  });

  it('keeps the requested two-column category order without a Records page', () => {
    expect(CATEGORY_COLUMNS.map((column) => column.flatMap(({ items }) => items))).toEqual([
      ['jokers', 'pouches', 'vouchers', 'tags', 'fableCards', 'constellationCards', 'inkCards'],
      ['enhancedTiles', 'editions', 'packs', 'palette', 'mascots', 'words', 'bosses'],
    ]);
  });

  it('matches consumable buttons to Vouchers and gives their freed height to Emoji Tiles', () => {
    const css = readFileSync(
      new URL('../src/ui/styles/screens.css', import.meta.url),
      'utf8',
    );
    expect(css).toContain('--category-button-h: 75px;');
    expect(css).toContain('--category-featured-h: 84px;');
    expect(css).toContain('--category-emoji-h: 164px;');
    expect(css).toMatch(
      /\.cat-family-block \.cat-btn\s*\{[^}]*flex:\s*0 0 var\(--category-button-h\);/s,
    );
  });

  it('pages Enhanced Tiles with the shared arrows instead of tabs', () => {
    const component = readFileSync(
      new URL('../src/ui/components/Collection.tsx', import.meta.url),
      'utf8',
    );
    const enhanced = component.slice(
      component.indexOf('function EnhancedTilesView()'),
      component.indexOf('function MaterialsView()'),
    );

    expect(enhanced).toContain('const [page, setPage] = useState(0);');
    expect(enhanced).toContain('{page === 0 ? <MaterialsView /> : <FontsView />}');
    expect(enhanced).toContain('<Pager page={page} pages={2} onPage={setPage} />');
    expect(enhanced).not.toContain('role="tablist"');
  });

  it('shows all 30 Tags as a two-page 5×3 image grid with shared interaction', () => {
    const component = readFileSync(
      new URL('../src/ui/components/Collection.tsx', import.meta.url),
      'utf8',
    );
    const css = readFileSync(
      new URL('../src/ui/styles/screens.css', import.meta.url),
      'utf8',
    );
    const tagsView = component.slice(
      component.indexOf('function TagsView()'),
      component.indexOf('function usePaged', component.indexOf('function TagsView()')),
    );

    expect(SKIP_REWARD_IDS).toHaveLength(30);
    expect(tagsView).toContain('visible.map((id) =>');
    expect(tagsView).toContain('SKIP_REWARD_ART[id]');
    expect(tagsView).toContain('skipRewardCollectionDescKey(id)');
    expect(tagsView).toMatch(
      /<div key=\{id\} className="tag-collection-entry">\s*<Tooltip[\s\S]*?>\s*<TiltCard/,
    );
    expect(tagsView).toContain('<Pager page={page} pages={pages} onPage={setPage} />');
    expect(component).toContain('const TAGS_PER_PAGE = 15;');
    expect(css).toMatch(
      /\.tag-collection-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(92px,\s*1fr\)\);/s,
    );
  });

  it('shows Starting Pouches as the reference-style single-item carousel', () => {
    const component = readFileSync(
      new URL('../src/ui/components/Collection.tsx', import.meta.url),
      'utf8',
    );
    const css = readFileSync(
      new URL('../src/ui/styles/screens.css', import.meta.url),
      'utf8',
    );

    expect(component).toContain('className="collection-pouch-carousel"');
    expect(component).toContain('const id = POUCH_IDS[index]!');
    expect(component).toContain('(current + delta + POUCH_IDS.length) % POUCH_IDS.length');
    expect(component).toContain('className="carousel-dots"');
    expect(component).not.toContain('className="pouch-grid"');
    expect(css).toMatch(
      /\.collection-pouch-carousel\s*\{[^}]*grid-template-columns:\s*50px minmax\(0,\s*1fr\) 50px;/s,
    );
    expect(css).toContain('width: 176px;');
  });

  it('wraps every shared Collection pager and hides the full word total until completion', () => {
    const component = readFileSync(
      new URL('../src/ui/components/Collection.tsx', import.meta.url),
      'utf8',
    );
    const pager = component.slice(component.indexOf('function Pager('));

    expect(pager).toContain('(page + delta + pages) % pages');
    expect(pager).not.toContain('page === 0');
    expect(pager).not.toContain('page === pages - 1');
    expect(component).toContain("{n.have}/{id === 'words' && !wordCollectionComplete ? '???' : n.total}");
    expect(component).toContain('const allWordsComplete = isWordCollectionComplete(lexicon);');
    expect(component).toContain("hideTotal={!allWordsComplete && !query.trim() && suit === 'all'}");
  });
});
