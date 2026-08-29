import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('random encounter laboratory', () => {
  it('reuses every live desk encounter as an independently resettable sample', () => {
    const desk = source('src/ui/components/DeskObjects.tsx');
    const lab = source('src/ui/components/DeskEncounterLab.tsx');
    expect(desk).toContain('export const DESK_KINDS');
    expect(desk).toContain('sampleKind?: DeskKind');
    expect(desk).toContain('if (!active || encounter || sampleKind) return');
    expect(desk).toContain('? <div className="desk-sample-root">{objects}</div>');
    expect(lab).toContain('DESK_KINDS.map');
    expect(lab).toContain('<DeskObjects active sampleKind={kind} resetToken={resetToken} />');
    expect(lab).toContain('setResetToken((value) => value + 1)');
    expect(lab).toContain("type LabTab = 'score' | 'encounters'");
    expect(lab).toContain('role="tablist"');
    expect(lab).toContain('role="tabpanel"');
    expect(lab).toContain("useState<LabTab>('score')");
    expect(lab).toContain("tabIndex={tab === 'score' ? 0 : -1}");
    expect(lab).toContain("tabIndex={tab === 'encounters' ? 0 : -1}");
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(lab).toContain(`event.key === '${key}'`);
    }
    expect(lab).toContain('tabRefs.current[next]?.focus()');
  });

  it('is reachable only in development and has a contained gallery layout', () => {
    const app = source('src/ui/App.tsx');
    const menu = source('src/ui/components/MainMenu.tsx');
    const css = source('src/ui/styles/screens.css');
    expect(app).toContain("| 'deskLab'");
    expect(app).toContain("case 'deskLab'");
    expect(app).toContain('const DeskEncounterLab = import.meta.env.DEV');
    expect(app).toContain("runFit={screen === 'run' || screen === 'deskLab'}");
    expect(menu).toContain('import.meta.env.DEV &&');
    expect(menu).toContain("t('menu.deskLab')");
    expect(css).toContain('.desk-lab-grid');
    expect(css).toContain('.desk-sample-root .desk-object');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
  });

  it('names and explains all ten samples in both languages', () => {
    const en: Record<string, string> = JSON.parse(source('locales/en.json'));
    const ko: Record<string, string> = JSON.parse(source('locales/ko.json'));
    for (const kind of ['cup', 'pot', 'bell', 'check', 'waxBall', 'keycap', 'shacoBox', 'fly', 'bulldog', 'launchButton']) {
      expect(en[`desk.encounter.${kind}.name`], kind).toBeTruthy();
      expect(en[`desk.encounter.${kind}.desc`], kind).toBeTruthy();
      expect(ko[`desk.encounter.${kind}.name`], kind).toBeTruthy();
      expect(ko[`desk.encounter.${kind}.desc`], kind).toBeTruthy();
    }
    expect(en['desk.bulldog.tooth']).toBeTruthy();
    expect(ko['desk.bulldog.tooth']).toBeTruthy();
  });
});
