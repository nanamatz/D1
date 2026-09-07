import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('rotating developer laboratory', () => {
  it('shows every production Score Keyboard tier', () => {
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    expect(lab.match(/desk-lab-card desk-lab-score-card/g)).toHaveLength(1);
    expect(en['desk.lab.scoreFeedback.title']).toBe('Score Keyboard Tiers 1–5');
    expect(en['desk.lab.scoreFeedback.body']).toContain('production Score Keyboard effect');
    expect(lab).toContain('<ScoreTypewriter');
    expect(lab).toContain('const TIERS = [1, 2, 3, 4, 5]');
    expect(en['desk.lab.replay']).toBe('Replay');
  });

  it('reuses the production ScoreTypewriter with UI-local Tier 1–5 state', () => {
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    const component = source('src/ui/components/ScoreTypewriter.tsx');
    expect(lab).toContain("import { ScoreTypewriter } from './ScoreTypewriter'");
    expect(lab).toContain('const [tier, setTier] = useState<ScoreTypewriterTier>(1)');
    expect(lab).toContain('beatId={`lab-${tier}-${replay}`}');
    expect(lab).toContain('{TIERS.map((value) => (');
    expect(lab).toContain('aria-pressed={tier === value}');
    expect(component).toContain("preview && 'is-lab-preview'");
    expect(component).toContain('return preview ? dock : createPortal(dock, document.body)');
    expect(lab).not.toContain('MoneyValue');
    for (const locale of [en, ko]) {
      expect(locale['desk.lab.title']).toBeTruthy();
      expect(locale['desk.lab.subtitle']).toBeTruthy();
      expect(locale['desk.lab.scoreFeedback.title']).toBeTruthy();
      expect(locale['desk.lab.scoreFeedback.body']).toBeTruthy();
      expect(locale['desk.lab.replay']).toBeTruthy();
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
    for (const retired of [
      'MoneyValue', 'MoneyLedger', 'DeskObjects', 'sampleKind', 'LAB_MONEY_DELTAS', 'ScoreTransferReadout', 'DESK_KINDS',
      'HIDDEN_PATTERN_IDS', 'PatternExampleTray',
      'requestAnimationFrame', 'storage', 'useSettings', 'rng',
      'role="tablist"', 'role="tabpanel"',
    ]) expect(lab).not.toContain(retired);
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
    expect(css).toMatch(/\.desk-lab-score-controls\s*\{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.desk-lab-score-controls\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.desk-lab-grid\s*\{\s*grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*?\.desk-lab-card,[\s\S]*?\.desk-lab-score-stage\s*\{\s*border-color:\s*CanvasText;/);
    expect(css).toMatch(/\.desk-lab-card\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.desk-lab-score-stage\s*\{[^}]*min-height:\s*500px;[^}]*place-items:\s*center;/s);
    expect(css).toMatch(/\.score-typewriter-dock\.is-lab-preview\s*\{[^}]*--typewriter-width:\s*min\(230px, 22vw, 38vh\);[^}]*position:\s*relative;/s);
  });
});
