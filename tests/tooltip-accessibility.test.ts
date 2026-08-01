import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('shared tooltip accessibility', () => {
  it('opens from focus-visible and links the focused object to the portal', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toContain("matches(':focus-visible')");
    expect(tooltip).toContain("'aria-describedby'");
    expect(tooltip).toContain("createPortal(card, document.body)");
  });

  it('routes letter tiles through the shared compact tooltip', () => {
    const tile = source('src/ui/components/Tile.tsx');
    expect(tile).toContain('anchorRef={rootRef}');
    expect(tile).toContain('compact');
    expect(tile).not.toContain('createPortal');
    expect(tile).not.toContain('tile-tt-portal');
  });

  it('makes the pouch dock a keyboard-reachable dialog control', () => {
    const pouch = source('src/ui/components/BagView.tsx');
    expect(pouch).toContain('<button');
    expect(pouch).toContain('aria-haspopup="dialog"');
    expect(pouch).toContain('aria-controls="pouch-contents-dialog"');
    expect(pouch).toContain('<Tooltip');
  });

  it('clears stale hover and focus when a tooltip is disabled', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toMatch(
      /if \(!disabled\) return;\s+setHovered\(false\);\s+setFocused\(false\);\s+setPosition\(null\);/,
    );
  });

  it('stacks enhancement tags and folds only the highest-priority multi-detail inline', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    const css = source('src/ui/styles/screens.css');
    const tokens = source('src/ui/styles/tokens.css');
    expect(tooltip).toContain('tt-enhancement-tag');
    expect(tooltip).toContain("hasSupplement ? 'has-sub' : ''");
    expect(tooltip).toContain('className="tt-inline-detail"');
    expect(tooltip).toContain('<span className="tt-sub-stack">');
    expect(tooltip).toContain('className="tt-sub-card"');
    expect(tooltip).toContain("TOOLTIP_DETAIL_PRIORITY[a.detail.kind ?? 'other']");
    expect(tooltip).toContain("classList.toggle(");
    expect(tooltip).toContain("'sub-right'");
    expect(css).not.toContain('.tt-card.tt-portal.has-sub');
    expect(css).toMatch(/\.tt-sub-stack\s*\{[^}]*right:\s*calc\(100% \+ var\(--tt-sub-gap\)\)/s);
    expect(css).toMatch(/\.tt-card\.tt-portal\.sub-right \.tt-sub-stack\s*\{[^}]*left:\s*calc\(100% \+ var\(--tt-sub-gap\)\)/s);
    expect(css).toMatch(/\.tt-sub-stack\s*\{[^}]*width:\s*fit-content[^}]*min-width:\s*min\(100%[^}]*max-width:\s*min\(140%, var\(--tt-w\)/s);
    expect(css).toMatch(/\.tt-sub-card\s*\{[^}]*width:\s*100%/s);
    expect(css).toMatch(/\.tt-card\.tile-tt\s*\{[^}]*width:\s*132px[^}]*min-width:\s*132px[^}]*max-width:\s*132px/s);
    expect(css).toMatch(/\.tile-tt \.tt-title\s*\{[^}]*font-size:\s*var\(--fs-xl\)/s);
    expect(css).toMatch(/\.tile-tt \.tt-body\s*\{[^}]*font-size:\s*var\(--fs-lg\)/s);
    expect(css).toMatch(/\.tt-enhancement-tag[\s\S]*width:\s*var\(--tt-tag-w\)/);
    expect(tokens).toContain('--tt-min-w: 150px');
    expect(tokens).toContain('--tt-w: 280px');
    expect(tokens).not.toContain('--tt-sub-w');
    expect(tokens).toContain('--tt-tag-w: 72%');
    expect(tokens).toContain("--tt-copy-font: 'Jost', 'Noto Sans KR', sans-serif");
    expect(css).toMatch(/\.tt-body\s*\{[^}]*font-family:\s*var\(--tt-copy-font\)[^}]*font-weight:\s*700/s);
    expect(css).not.toContain('.tt-card.down .tt-sub-card');
  });
});
