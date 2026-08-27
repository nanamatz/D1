import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/styles/screens.css', 'utf8');

describe('dialogue bubble CSS contract', () => {
  it('uses the readable dialogue tiers without enlarging labels', () => {
    expect(css).toMatch(/\.mascot-bubble\s*\{[^}]*font-size:\s*var\(--fs-lg\)/s);
    for (const selector of ['tut-body', 'intro-body', 'intro-hint']) {
      expect(css).toMatch(new RegExp(`\\.${selector}\\s*\\{[^}]*font-size:\\s*var\\(--fs-lg\\)`, 's'));
    }
    expect(css).toMatch(/\.unlock-recap-overlay \.go-mascot \.mascot-bubble\s*\{[^}]*font-size:\s*var\(--fs-2xl\)/s);
  });

  it('content-sizes bubbles and wraps greedily at word boundaries', () => {
    expect(css).toMatch(/\.mascot-bubble\s*\{[^}]*box-sizing:\s*border-box;[^}]*width:\s*max-content;[^}]*max-width:\s*100%;/s);
    expect(css).toMatch(/\.mascot-bubble\s*\{[^}]*text-wrap:\s*wrap;[^}]*word-break:\s*keep-all;[^}]*overflow-wrap:\s*normal;[^}]*hyphens:\s*none;/s);
    expect(css).not.toContain('text-wrap: balance');
    expect(css).toMatch(/\.unlock-recap-overlay \.go-mascot \.mascot-bubble\s*\{[^}]*width:\s*max-content;[^}]*max-width:\s*260px;/s);
  });

  it('hides only shop and run-end mascots in the narrow layout', () => {
    expect(css).toMatch(/@media \(max-width: 720px\)\s*\{\s*\.shop-rail > \.mascot,\s*\.go-mascot\s*\{\s*display:\s*none;/s);
    expect(css).not.toMatch(/@media \(max-width: 720px\)\s*\{\s*\.mascot\s*\{\s*display:\s*none;/s);
  });
});
