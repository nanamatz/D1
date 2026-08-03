import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('feedback 5 UI regressions', () => {
  const play = source('src/ui/styles/play.css');
  const screens = source('src/ui/styles/screens.css');

  it('attaches the primary sale action directly below its foreground card', () => {
    expect(play).toMatch(/\.shop-offer-action\s*\{[^}]*top:\s*calc\(100% \+ 8px\)/s);
    expect(play).toMatch(/\.shop-offer-action\s*\{[^}]*z-index:\s*40/s);
  });

  it('keeps sale actions separate from the card selection button', () => {
    const shop = source('src/ui/components/Shop.tsx');
    expect(shop).toContain('className="shop-offer-select"');
    expect(shop).not.toContain('role="button"');
    expect(shop).not.toContain('stopPropagation()');
  });

  it('makes shop-offered tile-targeting Fables buy-only and blind-usable', () => {
    const shop = source('src/ui/components/Shop.tsx');
    const game = source('src/ui/useGame.ts');

    expect(shop).toContain('!fableTargetsTiles(item.id)');
    expect(game).toContain('if (fableTargetsTiles(id) || isBlindOnlyConsumable(id)) return prev');
    expect(game).toContain('if (isBlindOnlyConsumable(id) || fableTargetsTiles(id)) return false');
    expect(game).not.toContain('openPouchSelect');
  });

  it('stretches the SHOP badge and geometrically centres blind-select copy', () => {
    expect(play).toMatch(/\.sidebar-shop \.blind-badge\s*\{[^}]*width:\s*100%/s);
    expect(play).toMatch(
      /\.sidebar\.sidebar-blindselect \.blind-badge \.kind\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s,
    );
  });

  it('keeps settlement at a readable 600ms base beat', () => {
    expect(source('src/ui/settle.tsx')).toContain('const BASE_STEP = 600');
  });

  it('uses the current-card height as every blind card minimum', () => {
    expect(screens).toMatch(/\.blindselect \.bs-card\s*\{[^}]*min-height:\s*386px/s);
  });

  it('raises the stage heading above the emphasized Revision card', () => {
    expect(screens).toMatch(/\.bs-head\s*\{[^}]*margin-bottom:\s*28px[^}]*transform:\s*none/s);
    expect(screens).toMatch(/\.bs-head \.label\s*\{[^}]*font-size:\s*var\(--ds-xs\)/s);
  });

  it('emphasizes the secondary tooltip subject and unifies available-space copy', () => {
    expect(screens).toMatch(/\.tt-sub-title\s*\{[^}]*font-size:\s*var\(--fs-lg\)[^}]*color:\s*#fff/s);
    expect(screens).toContain('text-shadow:');
    const ko = source('locales/ko.json');
    const en = source('locales/en.json');
    expect(ko.match(/공간이 있어야 합니다/g)).toHaveLength(4);
    expect(en.match(/Requires available space/g)).toHaveLength(4);
    expect(ko).not.toContain('소모품 슬롯이 비어있는 경우');
    expect(ko).not.toContain('빈 이모지 타일 슬롯에');
  });

  it('centres the boss intro in the phase workspace', () => {
    const runView = source('src/ui/components/RunView.tsx');
    expect(play).toMatch(/\.boss-intro\s*\{[^}]*position:\s*absolute/s);
    expect(runView).toContain('centred on the work surface');
    expect(runView.indexOf('centred on the work surface')).toBeGreaterThan(
      runView.indexOf('<section className="phase-workspace">'),
    );
  });

  it('offers Sketch Book rerolls only when the current blind is the boss', () => {
    const select = source('src/ui/components/BlindSelect.tsx');
    const game = source('src/ui/useGame.ts');

    expect(select).toMatch(/kind === 'boss'\s*&&\s*status === 'current'/);
    expect(game).toContain('if (prev.run.blindIndex !== 2) return prev;');
  });

  it('separates non-pattern sentence contributors during the landing beat', () => {
    const sidebar = source('src/ui/components/Sidebar.tsx');

    expect(sidebar).toContain('className="bonus-parts"');
    expect(sidebar).toContain("t('sidebar.bonusModifier'");
    expect(sidebar).toContain("t('sidebar.bonusUnisonChips'");
    expect(sidebar).toContain("t('sidebar.bonusEffectMult'");
    expect(play).toContain('.bonus-part.modifier');
    expect(play).toContain('.bonus-part.unison');
    expect(play).toContain('.bonus-part.effect');
  });

  it('plays the Constellation upgrade 500ms faster', () => {
    const level = source('src/ui/components/PatternLevelUp.tsx');

    expect(level).toContain('const PATTERN_LEVEL_DURATION_MS = 3500');
    expect(screens).toMatch(/\.pattern-levelup\s*\{[^}]*animation:\s*plu-overlay 3\.5s/s);
  });
});
