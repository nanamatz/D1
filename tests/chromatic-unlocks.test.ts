import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  UNLOCKS,
  loadPlayed,
  isPlayed,
  markPlayed,
  playedCount,
  resetUnlocks,
  activeUnlocks,
  checkWordPlayed,
  chromaMatrix,
} from '../src/ui/unlocks';

// jsdom is not configured project-wide; provide a minimal localStorage shim
// (matching tutorial-store.test.ts) so the played-set persistence round-trips.
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null, length: 0,
  } as Storage;
  resetUnlocks();
});

describe('chromatic unlocks — registry (feature-02 C)', () => {
  it('carries the initial table incl. the 4 color words + audio + mascots', () => {
    const ids = new Set(UNLOCKS.map((u) => u.id));
    for (const w of ['RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND', 'ALIEN', 'GHOST', 'DOG', 'TURTLE']) {
      expect(ids.has(w)).toBe(true);
    }
    expect(UNLOCKS.length).toBe(10);
  });

  it('does not gate the language — Korean is not a palette unlock (2026-07-30)', () => {
    expect(UNLOCKS.some((u) => u.id === 'KOREAN')).toBe(false);
    expect(UNLOCKS.some((u) => u.effect.kind === ('locale' as never))).toBe(false);
  });

  it('every unlock word is uppercase and equals its id (data-driven, no hard-coded checks)', () => {
    for (const u of UNLOCKS) {
      expect(u.word).toBe(u.word.toUpperCase());
      expect(u.id).toBe(u.word);
    }
  });
});

describe('chromatic unlocks — played persistence', () => {
  it('isPlayed is false until markPlayed, true after (persisted)', () => {
    expect(isPlayed('RED')).toBe(false);
    markPlayed('RED');
    expect(isPlayed('RED')).toBe(true);
    expect(loadPlayed().has('RED')).toBe(true);
  });

  it('markPlayed is idempotent', () => {
    markPlayed('BLUE');
    markPlayed('BLUE');
    expect(playedCount()).toBe(1);
  });
});

describe('chromatic unlocks — checkWordPlayed', () => {
  it('returns the def on first play (case-insensitive), null after / for non-unlock words', () => {
    expect(checkWordPlayed('turtle')?.id).toBe('TURTLE');
    expect(checkWordPlayed('TURTLE')).toBeNull(); // already played
    expect(checkWordPlayed('banana')).toBeNull(); // not an unlock word
  });
});

describe('chromatic unlocks — activeUnlocks + override', () => {
  it('active = played set normally; the unlock-all override lights everything', () => {
    markPlayed('GREEN');
    expect(activeUnlocks(false)).toEqual(new Set(['GREEN']));
    expect(activeUnlocks(true).size).toBe(UNLOCKS.length);
  });
});

describe('chromaMatrix — Emoji Tile art chroma gate (2026-07-30)', () => {
  const LUM = '0.2126 0.7152 0.0722';

  it('no colour unlocked → exactly grayscale(1)', () => {
    expect(chromaMatrix(new Set())).toBe(
      `${LUM} 0 0 ${LUM} 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('all four colours → the identity matrix (no filtering)', () => {
    expect(chromaMatrix(new Set(['RED', 'YELLOW', 'GREEN', 'BLUE']))).toBe(
      '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0',
    );
  });

  it('RED opens the red channel only; green and blue stay on luminance', () => {
    expect(chromaMatrix(new Set(['RED']))).toBe(
      `1 0 0 0 0 ${LUM} 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('YELLOW opens red AND green — the union of its channels', () => {
    expect(chromaMatrix(new Set(['YELLOW']))).toBe(
      `1 0 0 0 0 0 1 0 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('ignores non-colour unlocks', () => {
    expect(chromaMatrix(new Set(['MUSIC', 'SOUND', 'DOG']))).toBe(chromaMatrix(new Set()));
  });
});

describe('unlock-chroma filter — every Emoji Tile art surface, not just the owned shelf (2026-07-30 fix)', () => {
  const play = readFileSync(
    fileURLToPath(new URL('../src/ui/styles/play.css', import.meta.url)),
    'utf8',
  );
  const screens = readFileSync(
    fileURLToPath(new URL('../src/ui/styles/screens.css', import.meta.url)),
    'utf8',
  );

  /** The declaration block for the rule whose selector list contains `selector`. */
  const ruleFor = (css: string, selector: string): string => {
    const start = css.indexOf(selector);
    expect(start, `selector ${selector} not found`).toBeGreaterThanOrEqual(0);
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    return css.slice(open, close);
  };

  it.each([
    ['.joker-art', () => play],
    ['.shop-joker-art', () => play],
    ['.pack-joker-art', () => play],
    ['.cc-joker-art', () => screens],
  ])('%s carries the chroma-gate filter', (selector, css) => {
    expect(ruleFor(css(), selector)).toContain('filter: url(#unlock-chroma);');
  });
});
