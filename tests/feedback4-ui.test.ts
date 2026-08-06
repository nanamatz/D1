import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('feedback 4 UI regressions', () => {
  it('consumes settle presentation state before the persistent shop frame', () => {
    const game = source('src/ui/useGame.ts');
    const anim = source('src/ui/useAnim.ts');
    const sidebar = source('src/ui/components/Sidebar.tsx');

    expect(game).toContain('lastEvents: []');
    expect(game).toContain('sentenceBonus: null');
    expect(sidebar).toContain("mode !== 'blind'");
    expect(anim).toContain('return snap ? value : display');
  });

  it("shows each letter tile's own scoring contribution at that tile", () => {
    const settle = source('src/ui/settle.tsx');
    const tile = source('src/ui/components/Tile.tsx');

    expect(settle).toContain('tileEffectPop');
    expect(settle).toContain('gold: e.goldDelta');
    expect(settle).toContain("retrigger: e.effect === 'retriggerPlay'");
    expect(tile).toContain('className="trigger-pop tile-effect-pop"');
  });

  it('makes the entire blank cheque writable', () => {
    const css = source('src/ui/styles/play.css');
    const zone = css.slice(css.indexOf('.desk-check-sign-zone'), css.indexOf('.desk-check-signature'));
    expect(zone).toContain('inset: 0');
    expect(zone).not.toContain('left: 42%');
  });

  it('keeps instant use right of its offer and protects the right consumable tooltip', () => {
    const shop = source('src/ui/components/Shop.tsx');
    const css = source('src/ui/styles/play.css');

    expect(shop).toContain('shop-offer-action-secondary');
    expect(css).toContain('left: calc(100% + 12px)');
    expect(css).not.toContain('left: calc(50% + 38px)');
    expect(css).toContain('.consumable-slot:nth-child(n + 2)');
  });

  it('gives the current blind a taller, heavier accented treatment', () => {
    const css = source('src/ui/styles/screens.css');
    const current = css.slice(css.indexOf('.bs-card.current'), css.indexOf('.bs-kind'));
    expect(current).toContain('padding-block: 30px');
    expect(current).toContain('border-width: 5px');
    expect(current).toContain('outline: 3px solid var(--blind-accent)');
  });

  it('reveals Use only after selecting a Fable and labels blind-only cards Select', () => {
    const pack = source('src/ui/components/PackOpening.tsx');
    expect(pack).toContain('actionVisible={actionVisible}');
    expect(pack).toContain("blindOnlyFable ? 'pack.select' : 'consumable.useAction'");
    expect(pack).toContain('onSelectedCandidatesChange([])');
    expect(pack).toContain('canUseFableFromPack');
    expect(pack).not.toContain('instant/blind-only');
  });

  it('keeps enlarged action hit targets and the current Constellation timing', () => {
    const level = source('src/ui/components/PatternLevelUp.tsx');
    const play = source('src/ui/styles/play.css');
    const screens = source('src/ui/styles/screens.css');
    expect(level).toContain('const PATTERN_LEVEL_DURATION_MS = 3500');
    expect(screens).toMatch(/\.pattern-levelup\s*\{[^}]*animation:\s*plu-overlay 3\.5s/s);
    expect(play).toMatch(
      /\.btn\.sm,\s*\.consumable-menu\.bare button\s*\{[^}]*min-height:\s*var\(--shop-action-h\)/s,
    );
  });
});
