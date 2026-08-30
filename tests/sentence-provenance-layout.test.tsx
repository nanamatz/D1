import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { SentenceBonusDisplay } from '../src/ui/useGame';
import {
  FinalizedSentenceHeadline,
  SentenceBonusParts,
  sentenceBonusSupplementRowCount,
} from '../src/ui/components/Sidebar';
import { I18nProvider } from '../src/ui/i18n';
import { resetPersistedState } from '../src/ui/hooks';

class MemStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const base: SentenceBonusDisplay = {
  chips: 0,
  mult: 1,
  pattern: null,
  level: null,
  modifierCount: 0,
  modifierChips: 0,
  unisonSuit: null,
  unisonChips: 0,
  unisonMult: 1,
  registerSynergyId: null,
  registerSynergyChipsFactor: 1,
  effectChips: 0,
  effectMult: 1,
  effectScore: 0,
  pouchId: null,
  pouchChipsDelta: 0,
  pouchMultDelta: 0,
};

const render = (node: ReactNode, lang: 'en' | 'ko' = 'en'): string => {
  const storage = new MemStorage();
  storage.setItem('wj.lang', JSON.stringify(lang));
  vi.stubGlobal('localStorage', storage);
  resetPersistedState();
  return renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetPersistedState();
});

describe('finalized sentence headline', () => {
  it('renders nothing for a snapshot with no pattern or style', () => {
    expect(render(<FinalizedSentenceHeadline sentenceBonus={base} />)).toBe('');
    expect(render(<SentenceBonusParts sentenceBonus={base} />)).toBe('');
    expect(sentenceBonusSupplementRowCount(base)).toBe(0);
  });

  it('reuses the reserved headline for a real pattern without supplemental rows', () => {
    const html = render(<FinalizedSentenceHeadline sentenceBonus={{
      ...base, pattern: 'simple', level: 3,
    }} />);
    expect(html).toContain('class="round-pattern finalized-pattern"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Lv.3 · Simple"');
    expect(html).toContain('class="finalized-pattern-level">Lv.3');
    expect(html).toContain('class="pattern-symbol" aria-hidden="true"');
    expect(html).toContain('class="finalized-pattern-name">Simple');
    expect(html).not.toContain('bonus-stamp');
  });

  it.each([
    ['standard', 50, 1, 'Standard Unison +50 Chips'],
    ['formal', 0, 1.25, 'Formal Unison ×1.25'],
    ['slang', 0, 1.5, 'Slang Unison ×1.50'],
    ['vulgar', 0, 2, 'Vulgar Unison ×2'],
  ] as const)('renders reachable %s Unison in its semantic class', (suit, chips, mult, text) => {
    const snapshot: SentenceBonusDisplay = {
      ...base, unisonSuit: suit, unisonChips: chips, unisonMult: mult,
    };
    const html = render(<FinalizedSentenceHeadline sentenceBonus={snapshot} />);
    expect(html).toContain(`class="round-pattern finalized-pattern unison ${suit}"`);
    expect(html).toContain(`aria-label="${text}"`);
    expect(html).toContain(text);
    expect(sentenceBonusSupplementRowCount(snapshot)).toBe(0);
  });

  it.each([
    ['harmony', 1.25, 'Harmony ×1.25 Chips'],
    ['contrast', 1.5, 'Contrast ×1.50 Chips'],
    ['whiplash', 1.75, 'Whiplash ×1.75 Chips'],
    ['mishmash', 2, 'Mishmash ×2 Chips'],
  ] as const)('renders reachable %s Mixed Register in Chips semantics', (id, factor, text) => {
    const snapshot: SentenceBonusDisplay = {
      ...base, registerSynergyId: id, registerSynergyChipsFactor: factor,
    };
    const html = render(<FinalizedSentenceHeadline sentenceBonus={snapshot} />);
    expect(html).toContain('class="round-pattern finalized-pattern register-synergy"');
    expect(html).toContain(`aria-label="${text}"`);
    expect(html).toContain(text);
    expect(sentenceBonusSupplementRowCount(snapshot)).toBe(0);
  });

  it('combines pattern and style, colours the whole headline, and prioritizes Unison defensively', () => {
    const snapshot: SentenceBonusDisplay = {
      ...base,
      pattern: 'objectComplement',
      level: 4,
      unisonSuit: 'formal',
      unisonMult: 1.25,
      registerSynergyId: 'whiplash',
      registerSynergyChipsFactor: 1.75,
    };
    const html = render(<FinalizedSentenceHeadline sentenceBonus={snapshot} />);
    expect(html).toContain('class="round-pattern finalized-pattern unison formal"');
    expect(html).toContain('aria-label="Lv.4 · Object Complement · Formal Unison ×1.25"');
    expect(html).toContain('class="finalized-pattern-core"');
    expect(html).toContain('class="finalized-pattern-name">Object Complement');
    expect(html).not.toContain('Whiplash');
  });

  it('lets the longest English combination wrap without clipping any visible text', () => {
    const html = render(<FinalizedSentenceHeadline sentenceBonus={{
      ...base,
      pattern: 'objectComplement',
      level: 99,
      unisonSuit: 'formal',
      unisonMult: 1.25,
    }} />);
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    expect(html).toContain('Lv.99');
    expect(html).toContain('Object Complement');
    expect(html).toContain('Formal Unison ×1.25');
    expect(css).toMatch(/\.round-pattern\.finalized-pattern\s*\{[^}]*flex-wrap:\s*wrap[^}]*font-size:\s*var\(--fs-xs\)[^}]*overflow:\s*visible/s);
    expect(css).toMatch(/\.finalized-pattern-core,[\s\S]*\.finalized-style\s*\{[^}]*white-space:\s*nowrap/s);
  });

  it('keeps complete localized text and non-colour cues in Korean', () => {
    const snapshot: SentenceBonusDisplay = {
      ...base,
      pattern: 'objectComplement',
      level: 2,
      unisonSuit: 'slang',
      unisonMult: 1.5,
    };
    const html = render(<FinalizedSentenceHeadline sentenceBonus={snapshot} />, 'ko');
    expect(html).toContain('aria-label="Lv.2 · 5형식 · 속어 유니즌 ×1.50"');
    expect(html).toContain('5형식');
    expect(html).toContain('속어 유니즌 ×1.50');
  });

  it.each([
    ['standard', 50, 1, '표준 유니즌 +50칩'],
    ['formal', 0, 1.25, '격식 유니즌 ×1.25'],
    ['slang', 0, 1.5, '속어 유니즌 ×1.50'],
    ['vulgar', 0, 2, '비속어 유니즌 ×2'],
  ] as const)('renders reachable %s Unison completely in Korean', (suit, chips, mult, text) => {
    const html = render(<FinalizedSentenceHeadline sentenceBonus={{
      ...base, unisonSuit: suit, unisonChips: chips, unisonMult: mult,
    }} />, 'ko');
    expect(html).toContain(`aria-label="${text}"`);
    expect(html).toContain(text);
  });

  it.each([
    ['harmony', 1.25, '조화 ×1.25 칩'],
    ['contrast', 1.5, '대비 ×1.50 칩'],
    ['whiplash', 1.75, '급전환 ×1.75 칩'],
    ['mishmash', 2, '뒤죽박죽 ×2 칩'],
  ] as const)('renders reachable %s Mixed Register completely in Korean', (id, factor, text) => {
    const html = render(<FinalizedSentenceHeadline sentenceBonus={{
      ...base, registerSynergyId: id, registerSynergyChipsFactor: factor,
    }} />, 'ko');
    expect(html).toContain(`aria-label="${text}"`);
    expect(html).toContain(text);
  });

  it('renders pattern-only and pattern-plus-Mixed headlines completely in Korean', () => {
    const patternOnly = render(<FinalizedSentenceHeadline sentenceBonus={{
      ...base, pattern: 'simple', level: 3,
    }} />, 'ko');
    expect(patternOnly).toContain('aria-label="Lv.3 · 자동문"');
    expect(patternOnly).toContain('class="finalized-pattern-name">자동문');

    const combined = render(<FinalizedSentenceHeadline sentenceBonus={{
      ...base,
      pattern: 'objectComplement',
      level: 4,
      registerSynergyId: 'whiplash',
      registerSynergyChipsFactor: 1.75,
    }} />, 'ko');
    expect(combined).toContain('aria-label="Lv.4 · 5형식 · 급전환 ×1.75 칩"');
    expect(combined).toContain('5형식');
    expect(combined).toContain('급전환 ×1.75 칩');
  });
});

describe('grouped supplemental provenance', () => {
  it('renders Modifier as one row', () => {
    const snapshot = { ...base, modifierCount: 2, modifierChips: 30 };
    const html = render(<SentenceBonusParts sentenceBonus={snapshot} />);
    expect(sentenceBonusSupplementRowCount(snapshot)).toBe(1);
    expect(html.match(/class="bonus-part /g)).toHaveLength(1);
    expect(html).toContain('Modifiers ×2 +30 Chips');
  });

  it('groups all non-neutral effect axes into one visible Effects row', () => {
    const snapshot = { ...base, effectChips: 50, effectMult: 1.5, effectScore: 7_890 };
    const html = render(<SentenceBonusParts sentenceBonus={snapshot} />);
    expect(sentenceBonusSupplementRowCount(snapshot)).toBe(1);
    expect(html.match(/class="bonus-part /g)).toHaveLength(1);
    expect(html).toContain('class="bonus-part effect"');
    expect(html).toContain('Effects');
    expect(html).toContain('+50 Chips');
    expect(html).toContain('×1.50 Mult');
    expect(html).toContain('+7,890 Score');
  });

  it('keeps effect-only Broken Sentence values visible in Korean', () => {
    const html = render(<SentenceBonusParts sentenceBonus={{
      ...base, effectChips: 40, effectMult: 2,
    }} />, 'ko');
    expect(html).toContain('추가 효과');
    expect(html).toContain('+40 칩');
    expect(html).toContain('×2 배수');
  });

  it('renders Pouch as one row with both axes', () => {
    const snapshot: SentenceBonusDisplay = {
      ...base,
      pouchId: 'lunchBag',
      pouchChipsDelta: 60,
      pouchMultDelta: 0.5,
    };
    const html = render(<SentenceBonusParts sentenceBonus={snapshot} />);
    expect(sentenceBonusSupplementRowCount(snapshot)).toBe(1);
    expect(html).toContain('class="bonus-part pouch"');
    expect(html).toContain('Briefcase: +60 Chips · +0.50 Mult');
  });

  it('caps at three full-width rows in Modifier → Effects → Pouch order', () => {
    const snapshot: SentenceBonusDisplay = {
      ...base,
      modifierCount: 2,
      modifierChips: 30,
      effectChips: 50,
      effectMult: 1.5,
      effectScore: 7_890,
      pouchId: 'lunchBag',
      pouchChipsDelta: 60,
      pouchMultDelta: 0.5,
    };
    const html = render(<SentenceBonusParts sentenceBonus={snapshot} />);
    expect(sentenceBonusSupplementRowCount(snapshot)).toBe(3);
    expect(html.match(/class="bonus-part /g)).toHaveLength(3);
    expect(html.indexOf('bonus-part modifier')).toBeLessThan(html.indexOf('bonus-part effect'));
    expect(html.indexOf('bonus-part effect')).toBeLessThan(html.indexOf('bonus-part pouch'));
    expect(html).not.toContain('bonus-part unison');
    expect(html).not.toContain('bonus-part register-synergy');
  });
});

describe('dynamic score/control allocation', () => {
  it('uses no extra height for zero/one row and exact 468px pairs for two/three rows', () => {
    const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    expect(sidebar).toContain('provenanceRows >= 2 && `provenance-rows-${provenanceRows}`');
    expect(css).toMatch(/\.score-panel\s*\{[^}]*height:\s*136px[^}]*flex:\s*0 0 136px/s);
    expect(css).toContain('.score-panel.provenance-rows-2 { height: 159px; flex-basis: 159px; }');
    expect(css).toContain('.score-panel.provenance-rows-3 { height: 182px; flex-basis: 182px; }');
    expect(css).toContain('.score-panel.provenance-rows-2 + .sb-controls { --nav-h: 309px; }');
    expect(css).toContain('.score-panel.provenance-rows-3 + .sb-controls { --nav-h: 286px; }');
    expect(136 + 332).toBe(468);
    expect(159 + 309).toBe(468);
    expect(182 + 286).toBe(468);
  });

  it('removes fixed two-column clipping and keeps three full-width rows', () => {
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    const provenance = css.slice(css.indexOf('.bonus-parts'), css.indexOf('.sb-status.warn'));
    expect(provenance).toContain('flex-direction: column');
    expect(provenance).toMatch(/\.bonus-part\s*\{[^}]*width:\s*100%/s);
    expect(provenance).not.toContain('112px');
    expect(provenance).not.toContain('grid-template-columns');
    expect(provenance).not.toContain('overflow: hidden');
    expect(css).not.toContain('.score-panel.has-provenance');
    expect(css).not.toContain('height: 216px');
    expect(css).not.toContain('--nav-h: 252px');
  });

  it('uses palette tokens, forced-colour fallbacks, and existing reduced-motion animation', () => {
    const css = readFileSync('src/ui/styles/play.css', 'utf8');
    const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
    expect(css).toContain('.round-pattern.finalized-pattern.unison.standard { color: var(--suit-standard); }');
    expect(css).toContain('.round-pattern.finalized-pattern.unison.formal { color: var(--suit-formal); }');
    expect(css).toContain('.round-pattern.finalized-pattern.unison.slang { color: var(--suit-slang); }');
    expect(css).toContain('.round-pattern.finalized-pattern.unison.vulgar { color: var(--suit-vulgar); }');
    expect(css).toContain('.round-pattern.finalized-pattern.register-synergy { color: var(--chips); }');
    expect(css).toContain('.bonus-part.effect { color: var(--ink); }');
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*\.round-pattern\.finalized-pattern,[\s\S]*color:\s*CanvasText/s);
    expect(css).toContain('animation: stampIn .25s');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bonus-parts,[\s\S]*animation:\s*none/s);
    expect(tokens).toMatch(/:root\.world-mono[\s\S]*\.frame[\s\S]*filter:\s*grayscale\(1\)/s);
    expect(css).not.toContain('#d7a8ff');
  });
});
