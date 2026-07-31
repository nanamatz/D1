import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LETTER_HAND_REGISTRY } from '../src/engine/letterHands';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

describe('Run Info Letter Hands reference', () => {
  it('renders a dedicated tab from the headless registry', () => {
    const source = readFileSync('src/ui/components/RunInfo.tsx', 'utf8');
    expect(source).toContain("{ id: 'hands', label: 'runinfo.tabHands' }");
    expect(source).toContain('LETTER_HAND_REGISTRY.map');
  });

  it('uses the sentence-pattern Chips × Mult readout for hand bonuses', () => {
    const source = readFileSync('src/ui/components/RunInfo.tsx', 'utf8');
    const styles = readFileSync('src/ui/styles/screens.css', 'utf8');
    expect(source).toContain('className="ri-hand-score pcm"');
    expect(source).toContain('<b className="chips">+{bonus.chips}</b>');
    expect(source).toContain('<span className="times">×</span>');
    expect(source).toContain('<b className="mult">+{bonus.mult}</b>');
    expect(styles).toMatch(/\.ri-pat \.pcm,\s*\.ri-hand \.pcm\s*\{/);
  });

  it('provides both-locale condition copy for every registered hand', () => {
    for (const { id } of LETTER_HAND_REGISTRY) {
      expect(en).toHaveProperty(`letterhand.${id}.desc`);
      expect(ko).toHaveProperty(`letterhand.${id}.desc`);
    }
  });
});
