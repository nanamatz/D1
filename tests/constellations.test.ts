import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CONSTELLATION_DEFS,
  CONSTELLATION_IDS,
  CONSTELLATION_PATTERN,
  PATTERN_CONSTELLATION,
} from '../src/engine/constellations';
import { CONSTELLATION_ART } from '../src/ui/constellationArt';
import { CardArt } from '../src/ui/components/CardArt';
import { PATTERN_SYMBOLS } from '../src/ui/patternSymbols';

describe('Constellation cards', () => {
  it('maps all 12 zodiac cards one-to-one to the 12 sentence patterns', () => {
    expect(CONSTELLATION_DEFS).toHaveLength(12);
    expect(new Set(CONSTELLATION_DEFS.map((def) => def.pattern)).size).toBe(12);
    for (const def of CONSTELLATION_DEFS) {
      expect(CONSTELLATION_PATTERN[def.id]).toBe(def.pattern);
      expect(PATTERN_CONSTELLATION[def.pattern]).toBe(def.id);
    }
  });

  it('reuses every card zodiac mark as one unique sentence-pattern symbol', () => {
    expect(Object.keys(PATTERN_SYMBOLS)).toHaveLength(12);
    expect(new Set(Object.values(PATTERN_SYMBOLS)).size).toBe(12);
    expect(PATTERN_SYMBOLS.outcry).toBe('♎');
    expect(PATTERN_SYMBOLS.complex).toBe('♓');
  });

  it('keeps path-only SVG masters and maps every runtime PNG derivative', () => {
    expect(Object.keys(CONSTELLATION_ART)).toEqual([...CONSTELLATION_IDS]);
    const filenames = [
      'Libra', 'Leo', 'Aquarius', 'Aries', 'Taurus', 'Gemini',
      'Cancer', 'Virgo', 'Scorpio', 'Sagittarius', 'Capricorn', 'Pisces',
    ];
    for (const filename of filenames) {
      const source = fileURLToPath(
        new URL(`../docs/Arts/Cards/Constellation/Vector/${filename}.svg`, import.meta.url),
      );
      expect(existsSync(source)).toBe(true);
      const svg = readFileSync(source, 'utf8');
      expect(svg).toContain('width="500" height="700"');
      expect(svg).toContain('viewBox="0 0 250 350"');
      expect(svg).toContain('stretch fit');
      expect(svg).toContain('<path ');
      expect(svg).not.toMatch(/<image|data:image|\.png/);
    }
    expect(Object.values(CONSTELLATION_ART).every((art) => art.endsWith('-preview.png'))).toBe(true);
  });

  it('renders through the shared 5:7 SVG card geometry', () => {
    const markup = renderToStaticMarkup(createElement(CardArt, {
      family: 'constellation' as const,
      id: 'libra',
      title: 'Libra',
    }));
    expect(markup).toContain('viewBox="0 0 500 700"');
    expect(markup).toContain('family-card-svg-art');
    expect(markup).toContain('aria-label="Libra"');
  });
});
