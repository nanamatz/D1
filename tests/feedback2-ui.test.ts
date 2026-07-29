import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('feedback 2 UI regressions', () => {
  it('keeps the mascot picker in one horizontal row', () => {
    expect(source('src/ui/components/Collection.tsx')).toContain('card-grid mascot-card-row');
    expect(source('src/ui/styles/screens.css')).toMatch(
      /\.mascot-collection \.mascot-card-row\s*\{[^}]*flex-flow:\s*row nowrap/s,
    );
  });

  it('shows Tile/Charm pack actions on hover without transforming the button', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const css = source('src/ui/styles/play.css');
    expect(pack).toContain("hoverOnlyAction={o.kind === 'tile' || o.kind === 'joker'}");
    expect(pack.indexOf('</TiltCard>')).toBeLessThan(pack.indexOf('pack-option-action'));
    expect(css).toContain('.pack-option-shell.hover-action:hover > .pack-option-action');
    expect(css).toMatch(
      /\.btn\.pack-option-action:disabled\s*\{[^}]*transform:\s*translateX\(-50%\)/s,
    );
  });

  it('activates Fable-pack candidates immediately and supports held target Fables', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const run = source('src/ui/components/RunView.tsx');
    expect(pack).toContain("const candidatesActive = pack.offer.type === 'consumable'");
    expect(pack).toContain('packFableFxBus.on');
    expect(run).toContain('g.useHeldPackFable(id, packCandidateIds)');
  });

  it('previews target-axis changes and keeps tile score feedback at the source', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    const tile = source('src/ui/components/Tile.tsx');
    const settle = source('src/ui/settle.tsx');
    expect(pack).toContain('previewFableTile');
    expect(pack).toContain('fable-axis-change');
    expect(tile).toContain("'score-current'");
    expect(tile).toContain('tile-effect-pop');
    expect(settle).toContain('const BASE_STEP = 600');
    expect(settle).toContain('if (e.tileId) triggerTile(e.tileId)');
  });

  it('keeps enhanced tags visible and stabilizes tile-edge tilt', () => {
    const css = source('src/ui/styles/play.css');
    const hooks = source('src/ui/hooks.ts');
    expect(css).toMatch(/\.tile\.polished\s*\{[^}]*overflow:\s*visible/s);
    expect(css).toMatch(/\.tile:hover\s*\{[^}]*filter:\s*brightness/s);
    expect(hooks).toContain('let stableRect: DOMRect | null = null');
    expect(hooks).toContain('const r = stableRect ?? el.getBoundingClientRect()');
  });
});
