import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { inkClass, faceClass } from '../src/ui/game';
import type { Letter, Tile } from '../src/engine/types';

const tile = (letter: Letter): Tile => ({
  id: 'x',
  letter,
  material: 'ceramic',
  font: 'medium',
});

describe('P2-3 — tile ink by exact chip value', () => {
  it('gives every live base score its own class', () => {
    for (const value of [3, 6, 9, 12, 15, 24, 30]) {
      expect(inkClass(value)).toBe(`ink-${value}`);
    }
  });
  it('leaves Stone unclassified', () => {
    expect(inkClass(0)).toBe('');
  });
  it('keeps 3 Chips unchanged and assigns seven distinct colours', () => {
    const play = readFileSync('src/ui/styles/play.css', 'utf8');
    const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
    const colours = new Map([
      [3, '#54432f'], [6, '#3f694d'], [9, '#315f86'], [12, '#5b4f8b'],
      [15, '#844b78'], [24, '#9b4938'], [30, '#8a6420'],
    ]);
    expect(new Set(colours.values()).size).toBe(colours.size);
    for (const value of colours.keys()) {
      expect(play).toMatch(
        new RegExp(`\\.tile\\.ink-${value}\\s*\\{[^}]*var\\(--tile-ink-${value}\\)`),
      );
    }
    expect(tokens).toMatch(/:root\.unlock-yellow\s*\{[^}]*--tile-ink-3:\s*#54432f[^}]*--tile-ink-30:\s*#8a6420/s);
    expect(tokens).toMatch(/:root\.unlock-green\s*\{[^}]*--tile-ink-6:\s*#3f694d/s);
    expect(tokens).toMatch(/:root\.unlock-blue\s*\{[^}]*--tile-ink-9:\s*#315f86[^}]*--tile-ink-12:\s*#5b4f8b/s);
    expect(tokens).toMatch(/:root\.unlock-red\s*\{[^}]*--tile-ink-15:\s*#844b78[^}]*--tile-ink-24:\s*#9b4938/s);
  });
});

describe('P2-3 — vowel/consonant face tint (Y is a consonant)', () => {
  it('vowels', () => {
    expect(faceClass(tile('A'))).toBe('vowel');
    expect(faceClass(tile('E'))).toBe('vowel');
  });
  it('consonants incl. Y', () => {
    expect(faceClass(tile('B'))).toBe('cons');
    expect(faceClass(tile('Y'))).toBe('cons');
  });
});
