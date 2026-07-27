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
import { ConstellationCardArt } from '../src/ui/components/ConstellationCardArt';

describe('Constellation cards', () => {
  it('maps all 12 zodiac cards one-to-one to the 12 sentence patterns', () => {
    expect(CONSTELLATION_DEFS).toHaveLength(12);
    expect(new Set(CONSTELLATION_DEFS.map((def) => def.pattern)).size).toBe(12);
    for (const def of CONSTELLATION_DEFS) {
      expect(CONSTELLATION_PATTERN[def.id]).toBe(def.pattern);
      expect(PATTERN_CONSTELLATION[def.pattern]).toBe(def.id);
    }
  });

  it('maps every card to a Fable-sized path-only SVG asset', () => {
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
  });

  it('renders through the shared 5:7 SVG card geometry', () => {
    const markup = renderToStaticMarkup(createElement(ConstellationCardArt, {
      id: 'libra',
      title: 'Libra',
    }));
    expect(markup).toContain('viewBox="0 0 500 700"');
    expect(markup).toContain('family-card-svg-art');
    expect(markup).toContain('aria-label="Libra"');
  });
});
