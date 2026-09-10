import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { richText } from '../src/ui/richtext';

const source = (path: string) => readFileSync(path, 'utf8');

describe('requested UI polish', () => {
  it('prevents drag text highlighting while preserving editable text selection', () => {
    const tokens = source('src/ui/styles/tokens.css');
    expect(tokens).toMatch(/body\s*\{[^}]*-webkit-user-select:\s*none;[^}]*user-select:\s*none;/s);
    expect(tokens).toMatch(/input,\s*textarea,\s*\[contenteditable\]:not\(\[contenteditable='false'\]\)\s*\{[^}]*-webkit-user-select:\s*text;[^}]*user-select:\s*text;/s);
  });

  it('keeps button copy and tooltip parentheticals on one line', () => {
    const tokens = source('src/ui/styles/tokens.css');
    const screens = source('src/ui/styles/screens.css');
    const markup = renderToStaticMarkup(createElement(
      'span',
      null,
      richText('Effect ([m:×2 Mult] until clear) then ends'),
    ));

    expect(tokens).toMatch(/button\s*\{[^}]*white-space:\s*nowrap/s);
    expect(screens).toMatch(/\.tt-parenthetical,[\s\S]*?\{[^}]*white-space:\s*nowrap/s);
    expect(markup).toContain('<span class="tt-parenthetical">(<span class="hl-mult">');
  });

  it('keeps the mascot cursor on Pouches and Tags', () => {
    const cursor = source('src/ui/styles/cursor.css');
    expect(cursor).not.toMatch(/\.(?:bs-tag-icon|run-tag-icon|run-choice-art)[\s\S]*?cursor:\s*help/);
  });

  it('keeps the desk background stationary while only incoming content slides', () => {
    const tokens = source('src/ui/styles/tokens.css');
    const screens = source('src/ui/styles/screens.css');
    const transition = source('src/ui/components/ScreenTransition.tsx');
    expect(tokens).toMatch(/body\s*\{[\s\S]*?background:\s*var\(--world-background\)/);
    expect(transition).toContain('className="screen-pane-content"');
    expect(screens).toMatch(/\.screen-pane\.screen-in\.screen-anim\s*\{[^}]*animation:\s*screenRevealIn[^}]*background:\s*var\(--world-background\)/s);
    expect(screens).toMatch(/\.screen-pane\.screen-in\.screen-anim > \.screen-pane-content\s*\{[^}]*animation:\s*screenSlideIn/s);
    expect(screens).toMatch(/@keyframes screenRevealIn\s*\{[\s\S]*?clip-path:\s*inset\(0 0 0 100%\)[\s\S]*?clip-path:\s*inset\(0\)/s);
    expect(screens).toMatch(/\.screen-pane\s*\{[^}]*min-height:\s*max\(var\(--board-h\), calc\(100dvh \/ var\(--root-zoom\)\)\)/s);
    expect(transition.match(/<div className="screen-pane-content">/g)).toHaveLength(2);
  });

  it('skins every native checkbox with one accessible pixel-art treatment', () => {
    const screens = source('src/ui/styles/screens.css');
    expect(screens).toMatch(/input\[type='checkbox'\]\s*\{[^}]*appearance:\s*none[^}]*border-radius:\s*0/s);
    expect(screens).toMatch(/input\[type='checkbox'\]::after\s*\{[^}]*border-width:\s*0 4px 4px 0/s);
    expect(screens).toContain("input[type='checkbox']:checked::after");
    expect(screens).toContain("input[type='checkbox']:focus-visible");
    expect(screens).toMatch(/@media \(forced-colors: active\)[\s\S]*?input\[type='checkbox'\]/);
  });

  it('removes action arrows and keeps one marked-up reroll dollar sign', () => {
    const shop = source('src/ui/components/Shop.tsx');
    const screens = source('src/ui/styles/screens.css');
    for (const file of ['en', 'ko', 'ja', 'zh-CN', 'zh-TW', 'pt-BR', 'tr-TR']) {
      const locale = JSON.parse(source(`locales/${file}.json`)) as Record<string, string>;
      expect(locale['shop.next']).not.toContain('→');
      expect(locale['cashout.confirm']).not.toContain('→');
      expect(locale['shop.reroll']).not.toContain('${cost}');
    }
    expect(shop).toContain("cost: `[$:$${formatScore(cost)}]`");
    expect(screens).toMatch(/\.shop-rail-actions\s*\{[^}]*grid-auto-rows:\s*1fr/s);
    expect(screens).toMatch(/\.shop-rail\s*\{[^}]*min-width:\s*0/s);
    expect(screens).toMatch(/\.shop-rail \.next-blind,[\s\S]*?\.shop-rail \.reroll-btn\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*padding-inline:\s*10px;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere/s);
    expect(screens).not.toMatch(/\.shop-rail \.next-blind,[\s\S]*?\.shop-rail \.reroll-btn\s*\{[^}]*text-overflow:\s*ellipsis/s);
    expect(screens).toMatch(/\.shop-rail \.reroll-btn \.hl-money\s*\{[^}]*color:\s*var\(--gold\)[^}]*font-size:\s*1\.5em/s);
  });

  it('uses one decorative pixel icon instead of localized Back arrows', () => {
    const screens = source('src/ui/styles/screens.css');
    const gameOver = source('src/ui/components/GameOver.tsx');
    for (const file of ['de', 'en', 'es-ES', 'fr-FR', 'ja', 'ko', 'pl-PL', 'pt-BR', 'ru-RU', 'tr-TR', 'zh-CN', 'zh-TW']) {
      const locale = JSON.parse(source(`locales/${file}.json`)) as Record<string, string>;
      expect(locale['common.back']).not.toMatch(/^[‹←<¶]/);
      expect(locale['gameover.endless']).not.toContain('→');
    }
    expect(screens).toMatch(/\.back-bar::before,\s*\.desk-lab-back::before,\s*\.endless-mode-btn::after\s*\{[^}]*content:\s*'';[^}]*clip-path:\s*polygon/s);
    expect(screens).toMatch(/\.endless-mode-btn::after\s*\{[^}]*transform:\s*rotate\(180deg\)/s);
    expect(gameOver).toContain('className="btn gold endless-mode-btn"');
  });

  it('keeps localized tutorial actions inside a wider wrapping row', () => {
    const guided = source('src/ui/components/GuidedIntro.tsx');
    const spotlight = source('src/ui/components/SpotlightBubble.tsx');
    const screens = source('src/ui/styles/screens.css');
    expect(spotlight).toContain('Math.min(480, window.innerWidth * 0.92)');
    expect(screens).toMatch(/\.intro-wrap\s*\{[^}]*width:\s*min\(480px, 92vw\)/s);
    expect(screens).toMatch(/\.intro-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(screens).toMatch(/\.intro-skip-progress\s*\{[^}]*display:\s*inline-flex[^}]*flex:\s*none/s);
    expect(guided).toMatch(/className="intro-skip-progress"[\s\S]*?className="btn blue sm intro-skip"[\s\S]*?className="intro-dots"/);
    expect(guided).toContain('className="btn blue sm intro-skip"');
    expect(guided).toContain('className="btn sm intro-next"');
  });

  it('omits the redundant Sentence tray heading', () => {
    expect(source('src/ui/components/SentenceTray.tsx')).not.toContain("t('tray.title')");
  });

  it('runs every held Score Keyboard tier at the 1.5x cadence', () => {
    const play = source('src/ui/styles/play.css');
    expect([...play.matchAll(/--typewriter-ambient-speed:\s*(\d+)ms/g)].map((match) => Number(match[1])))
      .toEqual([545, 388, 339, 279, 243]);
  });
});
