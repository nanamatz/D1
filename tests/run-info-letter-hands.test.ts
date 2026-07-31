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

  it('provides both-locale condition copy for every registered hand', () => {
    for (const { id } of LETTER_HAND_REGISTRY) {
      expect(en).toHaveProperty(`letterhand.${id}.desc`);
      expect(ko).toHaveProperty(`letterhand.${id}.desc`);
    }
  });
});
