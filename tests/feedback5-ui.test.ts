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

  it('keeps voucher action presses out of the selecting card pointer layer', () => {
    const shop = source('src/ui/components/Shop.tsx');
    expect(shop.match(/onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/g)).toHaveLength(2);
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

  it('slows settlement to a readable 600ms base beat', () => {
    expect(source('src/ui/settle.tsx')).toContain('const BASE_STEP = 600');
  });

  it('keeps non-current blind cards equal and reserves a taller current card', () => {
    expect(screens).toMatch(/\.blindselect \.bs-card\s*\{[^}]*height:\s*342px/s);
    expect(screens).toMatch(/\.blindselect \.bs-card\.current\s*\{[^}]*height:\s*386px/s);
  });

  it('raises the stage heading above the emphasized Revision card', () => {
    expect(screens).toMatch(/\.bs-head\s*\{[^}]*transform:\s*translateY\(-28px\)/s);
    expect(screens).toMatch(/\.bs-head \.label\s*\{[^}]*font-size:\s*var\(--ds-xs\)/s);
  });

  it('emphasizes the secondary tooltip subject and uses positive slot copy', () => {
    expect(screens).toMatch(/\.tt-sub-title\s*\{[^}]*font-size:\s*var\(--fs-md\)[^}]*color:\s*var\(--gold\)/s);
    expect(source('locales/ko.json')).toContain('소모품 슬롯이 비어있는 경우');
    expect(source('locales/en.json')).toContain('when a consumable slot is empty');
  });

  it('centres the boss intro in the phase workspace', () => {
    const runView = source('src/ui/components/RunView.tsx');
    expect(play).toMatch(/\.boss-intro\s*\{[^}]*position:\s*absolute/s);
    expect(runView).toContain('centred on the work surface');
    expect(runView.indexOf('centred on the work surface')).toBeGreaterThan(
      runView.indexOf('<section className="phase-workspace">'),
    );
  });
});
