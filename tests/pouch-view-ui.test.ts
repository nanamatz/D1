import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('pouch hover summary and click view', () => {
  const pouch = source('src/ui/components/BagView.tsx');
  const runView = source('src/ui/components/RunView.tsx');
  const css = source('src/ui/styles/screens.css');

  it('shows remaining A-Z counts in a compact 13 by 2 hover grid', () => {
    expect(pouch).toContain('const LETTERS = Object.keys(BALANCE.bagComposition)');
    expect(pouch).toContain("className=\"pouch-letter-summary\"");
    expect(pouch).toContain('{counts[letter] ?? 0}');
    expect(css).toMatch(/\.pouch-letter-summary\s*\{[^}]*grid-template-columns:\s*repeat\(13, 38px\)/s);
    expect(pouch).toContain("document.querySelector<HTMLElement>('.phase-workspace')");
    expect(pouch).toContain('createPortal(');
    expect(css).toMatch(/\.pouch-letter-summary\s*\{[^}]*position:\s*absolute[^}]*left:\s*50%[^}]*top:\s*50%/s);
    expect(css).toContain('transform: translate(-50%, 50vh)');
    expect(pouch).toContain('onHoverChange?.(hovered && !open)');
    expect(runView).toContain("pouchHovered && 'pouch-hovered'");
    expect(runView).toContain('onHoverChange={setPouchHovered}');
    expect(css).toMatch(/\.frame\.pouch-hovered \.stage\s*\{[^}]*translateY\(102px\)/s);
  });

  it('toggles the full permanent pouch and dims tiles outside the remaining pouch', () => {
    expect(pouch).toContain('onClick={() => setOpen((value) => !value)}');
    expect(pouch).toContain('const remainingIds = new Set(tiles.map((tile) => tile.id))');
    expect(pouch).toContain('sortForDisplay(run.bag)');
    expect(pouch).toContain("remainingIds.has(tile.id) ? '' : 'missing'");
    expect(pouch).toContain('<TileView tile={tile} inspectable tooltip={tileTooltip(tile, t)} />');
    expect(css).toMatch(/\.pouch-tile-slot\s*\{[^}]*width:\s*64px[^}]*height:\s*64px/s);
    expect(css).toMatch(/\.pouch-tile-slot\.missing\s*\{[^}]*opacity:\s*\.28/s);
    expect(pouch).toContain('const full = tally(run.bag)');
    expect(pouch).toContain("t('bagview.totalVowels')");
    expect(pouch).toContain("t('bagview.totalConsonants')");
    expect(pouch).toContain("t('bagview.totalTiles')");
    expect(pouch).toContain('<b>{run.bag.length}</b>');
    expect(pouch).toContain('const remaining = tally(tiles)');
    expect(pouch).toContain('className="pouch-modal-letter-grid"');
    expect(pouch).toContain('{remaining.perLetter[letter] ?? 0}');
    expect(css).toMatch(/\.pouch-modal-letter-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  });

  it('sizes to its tiles, rises from below, and settles at screen center', () => {
    expect(css).toMatch(/\.pouch-overlay\s*\{[^}]*align-items:\s*center/s);
    expect(css).toMatch(/\.pouch-modal\s*\{[^}]*width:\s*fit-content[^}]*height:\s*auto/s);
    expect(css).toContain('grid-template-columns: repeat(var(--pouch-columns), 64px)');
    expect(pouch).toContain("style={{ '--pouch-columns': columns } as CSSProperties}");
    expect(css).toContain('transform: translateY(60vh)');
    expect(pouch).not.toContain('pouch-drawer-head');
    expect(pouch).not.toContain('pouch-remaining-label');
    expect(pouch).toContain('autoFocus className="btn cash pouch-close"');
    expect(pouch).toContain("t('common.close')");
  });
});
