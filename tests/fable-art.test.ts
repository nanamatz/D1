import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FABLE_IDS } from '../src/engine/fables';
import { FABLE_ART } from '../src/ui/fableArt';

describe('Fable card art', () => {
  it('maps all 18 cards to supplied PNG assets', () => {
    expect(Object.keys(FABLE_ART)).toEqual([...FABLE_IDS]);
    for (let number = 1; number <= FABLE_IDS.length; number += 1) {
      const source = fileURLToPath(
        new URL(`../docs/Arts/Cards/Fable/T_Fable${number}.png`, import.meta.url),
      );
      expect(existsSync(source)).toBe(true);
      expect(FABLE_ART[`fable${number}` as keyof typeof FABLE_ART]).toBeTruthy();
    }
  });
});
