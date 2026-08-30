import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SentenceBonusDisplay } from '../src/ui/useGame';
import { SentenceBonusParts } from '../src/ui/components/Sidebar';
import { I18nProvider } from '../src/ui/i18n';
import { resetPersistedState } from '../src/ui/hooks';
import { readFileSync } from 'node:fs';

class MemStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const maximumBreakdown: SentenceBonusDisplay = {
  chips: 180,
  mult: 3,
  pattern: 'simple',
  level: 3,
  modifierCount: 2,
  modifierChips: 30,
  unisonSuit: 'formal',
  unisonChips: 40,
  unisonMult: 2,
  registerSynergyId: null,
  registerSynergyChipsFactor: 1,
  effectChips: 50,
  effectMult: 1.5,
  effectScore: 7_890,
  pouchId: 'lunchBag',
  pouchChipsDelta: 60,
  pouchMultDelta: 0.5,
};

const registerBreakdown: SentenceBonusDisplay = {
  ...maximumBreakdown,
  unisonSuit: null,
  unisonChips: 0,
  unisonMult: 1,
  registerSynergyId: 'whiplash',
  registerSynergyChipsFactor: 2.5,
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetPersistedState();
});

describe('maximum finalized sentence provenance layout', () => {
  for (const lang of ['en', 'ko'] as const) {
    it(`renders all seven supplemental tags in ${lang} without changing their footprint`, () => {
      const storage = new MemStorage();
      storage.setItem('wj.lang', JSON.stringify(lang));
      vi.stubGlobal('localStorage', storage);
      resetPersistedState();

      const html = renderToStaticMarkup(
        <I18nProvider><SentenceBonusParts sentenceBonus={maximumBreakdown} /></I18nProvider>,
      );

      expect(html.match(/class="bonus-part /g)).toHaveLength(7);
      expect(html).toContain('class="bonus-part modifier"');
      expect(html).toContain('class="bonus-part unison chips"');
      expect(html).toContain('class="bonus-part unison mult"');
      expect(html).toContain('class="bonus-part effect chips"');
      expect(html).toContain('class="bonus-part effect mult"');
      expect(html).toContain('class="bonus-part effect score"');
      expect(html).toContain('class="bonus-part pouch"');
      expect(html).not.toContain('sidebar.bonus');
      expect(html.indexOf('bonus-part modifier')).toBeLessThan(html.indexOf('bonus-part unison'));
      expect(html.indexOf('bonus-part unison')).toBeLessThan(html.indexOf('bonus-part effect'));
      expect(html.indexOf('bonus-part effect')).toBeLessThan(html.indexOf('bonus-part pouch'));
    });

    it(`keeps the long Mixed Register alternative full-width in ${lang}`, () => {
      const storage = new MemStorage();
      storage.setItem('wj.lang', JSON.stringify(lang));
      vi.stubGlobal('localStorage', storage);
      resetPersistedState();

      const html = renderToStaticMarkup(
        <I18nProvider><SentenceBonusParts sentenceBonus={registerBreakdown} /></I18nProvider>,
      );

      expect(html.match(/class="bonus-part /g)).toHaveLength(6);
      expect(html).toContain('class="bonus-part register-synergy"');
      expect(html).not.toContain('sidebar.bonus');
      expect(html).not.toContain('registerSynergy.whiplash');
    });
  }

  it('bounds five tag rows while preserving the fixed 468px score/control total', () => {
    const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    expect(sidebar).toContain("bonusActive && 'has-provenance'");
    expect(css).toMatch(/\.score-panel\.has-provenance\s*\{[^}]*height:\s*216px[^}]*flex-basis:\s*216px[^}]*padding:\s*10px 12px/s);
    expect(css).toMatch(/\.score-panel\.has-provenance \.bonus-parts\s*\{[^}]*height:\s*112px[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[^}]*grid-auto-rows:\s*20px[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.score-panel\.has-provenance \.bonus-part\.modifier,\s*\.score-panel\.has-provenance \.bonus-part\.register-synergy,[\s\S]*grid-column:\s*1 \/ -1/);
    expect(css).toMatch(/\.score-panel\.has-provenance \+ \.sb-controls\s*\{[^}]*--nav-h:\s*252px/s);
    expect(css).toMatch(/\.bonus-part\s*\{[^}]*padding:\s*2px 9px[^}]*border-radius:\s*8px[^}]*font-size:\s*var\(--fs-sm\)/s);

    const scoreHeight = 216;
    const controlsHeight = 252;
    const availableProvenanceHeight = scoreHeight - 20 - 72 - 6 - 2;
    const fiveRows = 5 * 20 + 4 * 3;
    expect(scoreHeight + controlsHeight).toBe(468);
    expect(fiveRows).toBe(112);
    expect(availableProvenanceHeight).toBeGreaterThanOrEqual(fiveRows);
  });
});
