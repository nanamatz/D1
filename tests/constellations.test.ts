import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONSTELLATION_DEFS,
  CONSTELLATION_IDS,
  CONSTELLATION_PATTERN,
  PATTERN_CONSTELLATION,
} from '../src/engine/constellations';
import { CONSTELLATION_ART } from '../src/ui/constellationArt';

describe('Constellation cards', () => {
  it('maps all 12 zodiac cards one-to-one to the 12 sentence patterns', () => {
    expect(CONSTELLATION_DEFS).toHaveLength(12);
    expect(new Set(CONSTELLATION_DEFS.map((def) => def.pattern)).size).toBe(12);
    for (const def of CONSTELLATION_DEFS) {
      expect(CONSTELLATION_PATTERN[def.id]).toBe(def.pattern);
      expect(PATTERN_CONSTELLATION[def.pattern]).toBe(def.id);
    }
  });

  it('maps every card to the supplied PNG asset', () => {
    expect(Object.keys(CONSTELLATION_ART)).toEqual([...CONSTELLATION_IDS]);
    const filenames = [
      'Libra', 'Leo', 'Aquarius', 'Aries', 'Taurus', 'Gemini',
      'Cancer', 'Virgo', 'Scorpio', 'Sagittarius', 'Capricorn', 'Pisces',
    ];
    for (const filename of filenames) {
      const source = fileURLToPath(
        new URL(`../docs/Arts/Cards/Constellation/${filename}.png`, import.meta.url),
      );
      expect(existsSync(source)).toBe(true);
    }
  });
});
