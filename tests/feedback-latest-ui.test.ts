import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('latest feedback regressions', () => {
  const game = source('src/ui/useGame.ts');
  const pack = source('src/ui/components/PackOpening.tsx');
  const stage = source('src/ui/components/StagePanel.tsx');
  const play = source('src/ui/styles/play.css');

  it('syncs the fullscreen setting to the browser fullscreenchange event', () => {
    const settings = source('src/ui/settings.ts');
    expect(settings).toContain("document.addEventListener('fullscreenchange', syncFullscreen)");
    expect(settings).toContain('document.fullscreenElement !== null');
  });

  it('animates the exact Unopened Letter discard result reported by the engine', () => {
    expect(stage).toContain('g.state.bossDiscard');
    expect(stage).toContain("className=\"boss-discard-ghost\"");
    expect(play).toContain('@keyframes boss-letter-discard');
  });

  it('keeps enhanced Fable targets staged when they survive the effect', () => {
    expect(game).toContain('selected: prev.selected.filter((tileId) =>');
    expect(game).toContain('result.blind.hand.some((tile) => tile.id === tileId)');
  });

  it('uses Constellations directly from packs without checking held-slot capacity', () => {
    expect(game).toContain('const usePackConstellation');
    expect(game).toContain('if (option.kind === \'punctuation\') return prev');
    expect(pack).toContain('g.usePackConstellation(i)');
    expect(pack).not.toContain("takesConsumableSlot = o.kind === 'punctuation'");
  });

  it('shows Fable target application VFX and waits 0.5 seconds after completion', () => {
    expect(pack).toContain('previewFableTile(fableId, tile)');
    expect(pack).toContain('window.setTimeout(() => {');
    expect(pack).toContain('}, 500);');
    expect(play).toContain('.fable-effect-target');
  });

  it('prevents phase transitions and five-card packs from creating scroll containers', () => {
    expect(play).toMatch(/\.phase-blindselect \.blindselect-phase-panel\s*\{[^}]*overflow:\s*clip/s);
    expect(play).toMatch(/\.phase-shop \.pack-phase-panel\s*\{[^}]*overflow:\s*visible/s);
    expect(play).toMatch(/\.pack-fan\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--pack-count,\s*5\)/s);
  });

  it('keeps the sale panel height after its items are exhausted', () => {
    expect(play).toMatch(/\.shop-sale-region > \.panel\s*\{[^}]*min-height:\s*var\(--shop-lower-panel-h\)/s);
  });

  it('keeps live shop cards out of opened packs and disables stale purchases', () => {
    const shop = source('src/ui/components/Shop.tsx');
    const emojiUnlocks = source('src/ui/emojiUnlocks.ts');
    expect(game).toContain('rollPack(slot, prev.run, rng, prev.shop.items, unlockedEmojiSet())');
    expect(game).toContain("state.phase !== 'shop' || !state.shop");
    expect(game).toContain('canOwnJoker(prev.run, item.id) && shopEmojiSet().has(item.id)');
    expect(emojiUnlocks).toContain('if (import.meta.env.DEV) eligible.add(DEVELOPER_GRACE_ID);');
    expect(shop).toContain('canOwnConsumable(run, item.id)');
  });

  it('distinguishes additive from multiplicative Chips and Mult popups', () => {
    const tile = source('src/ui/components/Tile.tsx');
    const settle = source('src/ui/settle.tsx');
    expect(tile).toContain(
      '<span className="mult">+{Number.isInteger(effectPop.mult)',
    );
    expect(tile).toContain('effectPop.multFactor !== undefined');
    expect(tile).toContain('effectPop.chipsFactor !== undefined');
    expect(settle).toContain("'chipsFactor' in e");
    expect(settle).toContain("'multFactor' in e");
    expect(settle).toContain("chipsOp: chipsFactor !== undefined ? 'mul'");
    const shelf = source('src/ui/components/JokerShelf.tsx');
    expect(shelf).toContain('multFactor !== undefined ? `×${fmtMult(multFactor)}` : signed(mult)');
    expect(shelf).not.toContain('+×');
  });

  it('gives the Emoji Tile shelf remaining width with an exact 10px panel gap', () => {
    const shelf = source('src/ui/components/JokerShelf.tsx');
    expect(shelf).not.toContain('emojiPanelWidth');
    expect(shelf).not.toContain('className="joker empty"');
    expect(shelf).not.toContain('className="consumable empty"');
    expect(shelf).toContain("run.jokers.length > 5 ? ' jokers-overlap' : ''");
    expect(play).toMatch(/\.frame\s*\{[^}]*grid-template-columns:\s*var\(--rail-w\) minmax\(0,\s*1fr\)/s);
    expect(play).toMatch(/\.joker\s*\{[^}]*width:\s*var\(--shop-card-w\);[^}]*height:\s*var\(--shop-card-h\);/s);
    expect(play).toMatch(/\.shelf\s*\{[^}]*gap:\s*10px;/s);
    expect(play).toMatch(/\.jokers-col\s*\{[^}]*flex:\s*1 1 auto;/s);
    expect(play).toMatch(/\.jokers-group\s*\{[^}]*width:\s*100%;/s);
    expect(play).toMatch(/\.consumables-group\s*\{[^}]*width:\s*286px;/s);
    expect(play).toMatch(/\.joker-slot\s*\{[^}]*flex:\s*0 1 var\(--shop-card-w\)/s);
    expect(play).toMatch(/\.jokers\s*\{[^}]*justify-content:\s*center;[^}]*gap:\s*12px;/s);
    expect(play).toMatch(/\.jokers\.jokers-overlap\s*\{[^}]*gap:\s*0;/s);
    expect(play).toMatch(/\.jokers\.jokers-overlap \.joker-slot\s*\{[^}]*flex:\s*1 1 0;[^}]*width:\s*auto;/s);
    expect(play).toMatch(/\.jokers\.jokers-overlap \.joker-slot:last-child\s*\{[^}]*flex:\s*0 0 var\(--shop-card-w\)/s);
  });

  it('portals enlarged shared tooltips above every product panel', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    const screens = source('src/ui/styles/screens.css');
    const tokens = source('src/ui/styles/tokens.css');
    expect(tooltip).toContain('createPortal(card, document.body)');
    expect(tooltip).toContain('requestAnimationFrame(track)');
    expect(tokens).toContain('--tt-w: 280px');
    expect(tokens).toContain('--z-tooltip: 10000');
    expect(screens).toMatch(/\.tt-card\.tt-portal\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*var\(--z-tooltip\)/s);
    expect(screens).toMatch(/\.tt-body\s*\{[^}]*font-size:\s*var\(--fs-lg\)/s);
  });

  it('keeps the Emoji Tile and consumable slot panels the same height', () => {
    expect(play).toMatch(/\.shelf-group\s*\{[^}]*height:\s*187px;/s);
  });

  it('keeps both Words collection tabs in one fixed-height content slot', () => {
    const collection = source('src/ui/components/Collection.tsx');
    const screens = source('src/ui/styles/screens.css');
    expect(collection).toContain('className="word-tab-panel"');
    expect(screens).toMatch(/\.word-tab-panel\s*\{[^}]*height:\s*300px;[^}]*overflow-y:\s*auto;/s);
  });

  it('uses pixel-pencil scrollbars only for genuine overflow', () => {
    const tokens = source('src/ui/styles/tokens.css');
    const screens = source('src/ui/styles/screens.css');
    expect(tokens).toMatch(/::-webkit-scrollbar-thumb:vertical\s*\{[^}]*linear-gradient\(to bottom,[^}]*#d76879/s);
    expect(tokens).toMatch(/::-webkit-scrollbar-thumb:horizontal\s*\{[^}]*linear-gradient\(to right,[^}]*#d76879/s);
    expect(`${tokens}\n${screens}\n${play}`).not.toMatch(/overflow(?:-[xy])?:\s*scroll[;\s]/);
    expect(screens).not.toContain('scrollbar-gutter: stable');
  });

  it('lets the Published modal use the available viewport height', () => {
    const screens = source('src/ui/styles/screens.css');
    expect(screens).toMatch(/\.overlay\.gameover-overlay:has\(\.go-won\)\s*\{[^}]*padding-block:\s*12px;/s);
    expect(screens).toMatch(/\.overlay-card\.gameover\.go-won\s*\{[^}]*max-height:\s*calc\(100vh - 24px\);/s);
  });

  it('animates only the Main Menu title and disables it for reduced motion', () => {
    const screens = source('src/ui/styles/screens.css');
    expect(screens).toMatch(/\.menu \.logotype\s*\{[^}]*animation:\s*menu-title-float/s);
    expect(screens).toMatch(/\.menu \.lt-bang\s*\{[^}]*animation:\s*menu-title-bang/s);
    expect(screens).toMatch(/prefers-reduced-motion:[^}]+\)[\s\S]*\.menu \.logotype,[\s\S]*\.menu \.lt-bang\s*\{\s*animation:\s*none;/s);
  });

  it('maps each Main Menu action to its chromatic unlock group', () => {
    const screens = source('src/ui/styles/screens.css');
    expect(screens).toMatch(/\.menu-play\s*\{\s*background:\s*var\(--chips\)/);
    expect(screens).toMatch(/\.menu-options\s*\{\s*background:\s*var\(--gold\)/);
    expect(screens).toMatch(/\.menu-collection\s*\{\s*background:\s*var\(--btn-green\)/);
    expect(screens).toMatch(/\.menu-quit\s*\{\s*background:\s*var\(--mult\)/);
  });

  it('shares the sidebar surface with both shelves and bottom-aligns the shop', () => {
    expect(play).toMatch(/\.sidebar\s*\{[^}]*background:\s*var\(--rail-surface\)/s);
    expect(play).toMatch(/\.shelf-group\s*\{[^}]*background:\s*var\(--rail-surface\)/s);
    expect(play).toMatch(/\.shop-phase-panel\s*\{[^}]*align-items:\s*flex-end;[^}]*padding-bottom:\s*0;/s);
  });

  it('states the ×1 base in the scaling Emoji Tile current-value row', () => {
    const ko = JSON.parse(source('locales/ko.json')) as Record<string, string>;
    const en = JSON.parse(source('locales/en.json')) as Record<string, string>;
    expect(ko['joker.currentMult']).toContain('×{value}');
    expect(en['joker.currentMult']).toContain('×{value}');
  });
});
