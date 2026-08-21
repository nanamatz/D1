import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runView = readFileSync('src/ui/components/RunView.tsx', 'utf8');
const shop = readFileSync('src/ui/components/Shop.tsx', 'utf8');
const pack = readFileSync('src/ui/components/PackOpening.tsx', 'utf8');
const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
const playCss = readFileSync('src/ui/styles/play.css', 'utf8');
const screenCss = readFileSync('src/ui/styles/screens.css', 'utf8');
const tokensCss = readFileSync('src/ui/styles/tokens.css', 'utf8');

describe('persistent Balatro-style run table', () => {
  it('keeps sidebar, shelves and pouch in one frame without an in-run ScreenTransition', () => {
    expect(runView).toContain("'persistent-run'");
    expect(runView).toContain('<Sidebar');
    expect(runView).toContain('<JokerShelf');
    expect(runView).toContain('<BagWidget');
    expect(runView).not.toContain('<ScreenTransition');
  });

  it('shows prepared phase and discard counts during Blind Select', () => {
    expect(sidebar).toContain("const showBlindResources = mode !== 'shop';");
    expect(sidebar).toContain('showBlindResources ? blind.phasesTotal - blind.phasesUsed : 0');
    expect(sidebar).toContain('showBlindResources ? blind.discardsLeft : 0');
  });

  it('allows use-now when only the consumable slot cap is full', () => {
    expect(shop).toContain('action2Disabled: run.gold < item.price');
  });

  it('gates instant Fable use before charging for an unusable offer', () => {
    expect(shop).toContain('!canUseUnheldFable(');
    expect(shop).toContain('unlockedEmojiSet()');
    expect(readFileSync('src/ui/useGame.ts', 'utf8')).toContain('!canUseUnheldFable(id,');
  });

  it('shows and charges instant Gambler use only when it can resolve without a tile field', () => {
    expect(shop).toContain('canUseUnheldGambler(item.id, run, [], [], unlockedEmojiSet())');
    const game = readFileSync('src/ui/useGame.ts', 'utf8');
    expect(game).toContain('!canUseUnheldGambler(id, prev.run, [], [], unlockedEmojiSet())');
    expect(game).toContain('return canUseGambler(');
    expect(game).toContain('unlockedEmojiSet()');
  });

  it('shows ten seeded Fable effect candidates and keeps pack info in the footer', () => {
    expect(pack).toContain('candidateTiles.map');
    expect(pack).toContain('className="shop-head panel pack-footer"');
  });

  it('centres viewport overlays outside the persistent rail and zoomed board', () => {
    expect(runView).toContain('{settling && <CashOut g={g} discoveredLetterHands={discoveredLetterHands} />}');
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
    expect(playCss).toMatch(/\.shop-sign-lights\s*\{[^}]*inset:\s*8px[^}]*border:\s*5px dotted/s);
    expect(playCss).toMatch(/\.shop-sign-lights i\s*\{[^}]*display:\s*none/s);
  });

  it('caps UI scale to a fixed-height board that cannot scroll the viewport', () => {
    expect(tokensCss).toContain('--board-h: 988px');
    expect(tokensCss).toContain('--fit-safe-y: 4px');
    expect(playCss).toMatch(/\.frame\s*\{[^}]*min-height:\s*var\(--board-h\)/s);
    expect(playCss).toMatch(/\.persistent-run \.main\s*\{[^}]*min-height:\s*calc\(var\(--board-h\)/s);
    expect(screenCss).toMatch(/\.screen\s*\{[^}]*max-width:\s*var\(--board-max\)[^}]*min-height:\s*var\(--board-h\)/s);
    expect(screenCss).toMatch(/\.screen-stack\s*\{[^}]*max-width:\s*var\(--board-max\)[^}]*min-height:\s*var\(--board-h\)/s);
    expect(screenCss).toMatch(/\.screen-pane\s*\{[^}]*min-height:\s*var\(--board-h\)/s);
    expect(screenCss).toContain('zoom: min(var(--ui-scale, 1), var(--fit-scale, 1))');
  });

  it('reserves the live pattern line before the second word completes a pattern', () => {
    expect(sidebar).toContain('className="round-pattern"');
    expect(playCss).toMatch(/\.round-panel\s*\{[^}]*flex:\s*0 0 148px[^}]*height:\s*148px/s);
    expect(playCss).toMatch(/\.score-panel\s*\{[^}]*height:\s*136px/s);
  });
});
