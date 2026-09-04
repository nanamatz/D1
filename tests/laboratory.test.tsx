import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeskEncounterLab } from '../src/ui/components/DeskEncounterLab';
import { I18nProvider } from '../src/ui/i18n';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('rotating developer laboratory', () => {
  it('shows the current Shop Use Now cost/full-payout ledger in order', () => {
    const markup = renderToStaticMarkup(createElement(
      I18nProvider,
      null,
      createElement(DeskEncounterLab, { onBack: () => undefined }),
    ));

    expect(markup.match(/desk-lab-card desk-lab-money-card/g)).toHaveLength(1);
    expect(markup).toContain(en['consumable.fable9']);
    expect(markup.indexOf('-$3')).toBeLessThan(markup.indexOf('+$7'));
    expect(markup).toContain('aria-label="$10, -$3, +$7, $14"');
    expect(markup).toContain(en['settle.retrigger']);
  });

  it('reuses the production ledger renderer and existing bilingual Fable copy', () => {
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    expect(lab).toContain("import { MoneyLedger } from './MoneyValue'");
    expect(lab).toContain('const LAB_MONEY_DELTAS = [-3, 7] as const');
    expect(lab).toContain('<MoneyLedger key={sequence}');
    for (const locale of [en, ko]) {
      expect(locale['desk.lab.title']).toBeTruthy();
      expect(locale['desk.lab.subtitle']).toBeTruthy();
      expect(locale['shop.instantUse']).toBeTruthy();
      expect(locale['consumable.fable9']).toBeTruthy();
      expect(locale['consumabledesc.fable9']).toBeTruthy();
      expect(locale['settle.retrigger']).toBeTruthy();
    }
    expect(en['desk.lab.subtitle']).toBe(
      'Review the latest player-facing implementation or change that cannot be inspected immediately in Collection or Run Info',
    );
    expect(ko['desk.lab.subtitle']).toBe(
      '컬렉션 또는 런 정보에서 바로 확인할 수 없는 최신 플레이어 대상 구현 또는 변경을 검수하세요',
    );
  });

  it('defines one visibility-based policy for all completed player-facing work', () => {
    const agents = source('AGENTS.md');
    const docs = [
      agents,
      source('docs/GDD.md'),
      source('docs/UI_DESIGN.md'),
      source('docs/screens-spec.md'),
    ];
    for (const doc of docs) {
      expect(doc).toContain('completed player-facing implementation or change');
      expect(doc).toContain('cannot be inspected immediately in Collection or Run Info');
    }
    for (const kind of ['gameplay', 'audio', 'animation']) expect(agents).toContain(kind);
    expect(agents).toContain('internal-only refactors do not qualify');
  });

  it('has no retired preview, engine simulation, persistence, settings, or RNG path', () => {
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    const desk = source('src/ui/components/DeskObjects.tsx');
    for (const retired of [
      'ScoreTypewriter', 'DeskObjects', 'DESK_KINDS', 'HIDDEN_PATTERN_IDS',
      'PatternExampleTray', 'useEffect',
      'setTimeout', 'requestAnimationFrame', 'storage', 'useSettings', 'rng',
      'role="tablist"', 'role="tabpanel"',
    ]) expect(lab).not.toContain(retired);
    expect(desk).not.toContain('sampleKind');
    expect(desk).not.toContain('resetToken');
    expect(desk).not.toContain('desk-sample-root');
  });

  it('keeps the DEV-only entry, Back/Escape hook, responsive stack, and Forced Colors border', () => {
    const app = source('src/ui/App.tsx');
    const menu = source('src/ui/components/MainMenu.tsx');
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    const css = source('src/ui/styles/screens.css');
    expect(app).toContain("| 'deskLab'");
    expect(app).toContain("case 'deskLab'");
    expect(app).toContain('const DeskEncounterLab = import.meta.env.DEV');
    expect(app).toContain('.screen-pane.screen-in .desk-lab-back');
    expect(menu).toContain('import.meta.env.DEV &&');
    expect(menu).toContain("t('menu.deskLab')");
    expect(lab).toContain('className="btn desk-lab-back"');
    expect(css).toMatch(/\.desk-lab-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 680px\)/s);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.desk-lab-grid\s*\{\s*grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*?\.desk-lab-card,[\s\S]*?\.desk-lab-money-stage\s*\{\s*border-color:\s*CanvasText;/);
    expect(css).toMatch(/\.desk-lab-card\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.desk-lab-money-stage\s*\{[^}]*grid-template-columns:/s);
  });
});
