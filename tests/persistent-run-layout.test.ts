import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runView = readFileSync('src/ui/components/RunView.tsx', 'utf8');
const shop = readFileSync('src/ui/components/Shop.tsx', 'utf8');
const pack = readFileSync('src/ui/components/PackOpening.tsx', 'utf8');
const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
const playCss = readFileSync('src/ui/styles/play.css', 'utf8');
const screenCss = readFileSync('src/ui/styles/screens.css', 'utf8');

describe('persistent Balatro-style run table', () => {
  it('keeps sidebar, shelves and pouch in one frame without an in-run ScreenTransition', () => {
    expect(runView).toContain("'persistent-run'");
    expect(runView).toContain('<Sidebar');
    expect(runView).toContain('<JokerShelf');
    expect(runView).toContain('<BagWidget');
    expect(runView).not.toContain('<ScreenTransition');
  });

  it('allows use-now when only the consumable slot cap is full', () => {
    expect(shop).toContain('action2Disabled: run.gold < item.price');
  });

  it('gates instant Fable use before charging for an unusable offer', () => {
    expect(shop).toContain('!canUseUnheldFable(item.id, run, g.state.blind)');
    expect(readFileSync('src/ui/useGame.ts', 'utf8')).toContain(
      '!canUseUnheldFable(id, prev.run, prev.blind)',
    );
  });

  it('shows ten seeded Fable effect candidates and keeps pack info in the footer', () => {
    expect(pack).toContain('candidateTiles.map');
    expect(pack).toContain('className="shop-head panel pack-footer"');
  });

  it('centres viewport overlays outside the persistent rail and zoomed board', () => {
    expect(runView).toContain('{settling && <CashOut g={g} />}');
    expect(runView).toContain('createPortal((');
    expect(runView).toContain('Viewport-centred overlays live outside `.frame`');
    expect(screenCss).toMatch(/\.overlay\.cashout-overlay\s*\{[^}]*position:\s*fixed/s);
    expect(screenCss).toMatch(/\.options\s*\{[^}]*justify-content:\s*center/s);
  });

  it('uses a marquee SHOP header and an unclipped sale-tooltip layer', () => {
    expect(sidebar).toContain('shop-sign-word');
    expect(sidebar).toContain('shop-sign-lights');
    expect(sidebar).toContain('blindselect-prompt');
    expect(playCss).toMatch(/\.shop-phase-panel\s*\{[^}]*overflow:\s*visible/s);
    expect(playCss).toContain('@keyframes shop-sign-idle');
  });
});
