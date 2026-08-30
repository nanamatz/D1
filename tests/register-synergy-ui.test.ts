import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('register synergy UI provenance', () => {
  it('shows the live name and X Chips factor in the sentence tray', () => {
    const tray = read('src/ui/components/SentenceTray.tsx');
    expect(tray).toContain('judgment.registerSynergy');
    expect(tray).toContain("t(`registerSynergy.${synergy.id}`)");
    expect(tray).toContain("'tray.registerSynergyPlus'");
  });

  it('renders Mixed Register in the finalized Chips-colour headline', () => {
    const sidebar = read('src/ui/components/Sidebar.tsx');
    const css = read('src/ui/styles/play.css');
    expect(sidebar).toContain('FinalizedSentenceHeadline');
    expect(sidebar).toContain('hasRegisterSynergy');
    expect(sidebar).toContain('sidebar.bonusRegisterSynergy');
    expect(sidebar).toContain('sentenceBonus.registerSynergyId');
    expect(sidebar).not.toContain('bonus-part register-synergy');
    expect(css).toContain('.round-pattern.finalized-pattern.register-synergy { color: var(--chips); }');
  });

  it('keeps all names and factor labels paired in English and Korean', () => {
    for (const locale of [en, ko] as Record<string, string>[]) {
      for (const id of ['harmony', 'contrast', 'whiplash', 'mishmash']) {
        expect(locale[`registerSynergy.${id}`]).toBeTruthy();
      }
      expect(locale['tray.registerSynergy']).toContain('{factor}');
      expect(locale['sidebar.bonusRegisterSynergy']).toContain('{factor}');
    }
  });
});
