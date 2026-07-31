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
});
