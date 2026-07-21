import { describe, it, expect, beforeEach } from 'vitest';
import { availableWooDakSkins, woodakArt, mascotSrc, mascotVariantArt, WOODAK_SKINS } from '../src/ui/mascots';
import { markPlayed, resetUnlocks } from '../src/ui/unlocks';

// jsdom is not configured project-wide; provide a minimal localStorage shim
// (matching chromatic-unlocks.test.ts) so the selection + played set round-trip.
let store: Record<string, string>;
beforeEach(() => {
  store = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null, length: 0,
  } as Storage;
  resetUnlocks();
});

const woodakUrl = WOODAK_SKINS.find((s) => s.id === 'woodak')!.art!;
const dogUrl = WOODAK_SKINS.find((s) => s.id === 'dog')!.art!;
const setSettings = (o: Record<string, unknown>) => { store['wj.settings'] = JSON.stringify(o); };

describe('WooDak skins — availability', () => {
  it('only the default is available with nothing unlocked', () => {
    const skins = availableWooDakSkins(new Set());
    expect(skins.map((s) => s.id)).toEqual(['woodak']);
  });

  it('DOG becomes available once unlocked; art-less variants never do', () => {
    const skins = availableWooDakSkins(new Set(['DOG', 'MONSTER', 'GHOST', 'CAT']));
    // dog has art → included; monster/ghost/cat are unlocked but art-less → excluded.
    expect(skins.map((s) => s.id)).toEqual(['woodak', 'dog']);
  });
});

describe('WooDak skins — art resolution (with fallback)', () => {
  it('falls back to the default when the selected skin is not unlocked', () => {
    expect(woodakArt('dog', new Set())).toBe(woodakUrl);
  });

  it('returns the dog art when dog is selected and unlocked', () => {
    expect(woodakArt('dog', new Set(['DOG']))).toBe(dogUrl);
  });

  it('an art-less selection resolves to the default', () => {
    expect(woodakArt('monster', new Set(['MONSTER']))).toBe(woodakUrl);
  });
});

describe('mascotVariantArt — drives the unlock celebration', () => {
  it('returns the art for a variant that has it (dog), null for art-less variants', () => {
    // dog has art → the reveal shows the portrait + the "ready" message
    expect(mascotVariantArt('dog')).toBe(dogUrl);
    // monster/ghost/cat have no art yet → the reveal stays "coming soon"
    expect(mascotVariantArt('monster')).toBeNull();
    expect(mascotVariantArt('ghost')).toBeNull();
    expect(mascotVariantArt('cat')).toBeNull();
  });
});

describe('mascotSrc — reads live selection from storage', () => {
  it('piyak is fixed regardless of selection', () => {
    setSettings({ mascot: 'dog' });
    markPlayed('DOG');
    expect(mascotSrc('piyak')).toContain('piyak');
  });

  it('woodak applies the selected+unlocked skin, else the default', () => {
    // selected dog but not unlocked → default
    setSettings({ mascot: 'dog' });
    expect(mascotSrc('woodak')).toBe(woodakUrl);
    // unlock dog → dog art
    markPlayed('DOG');
    expect(mascotSrc('woodak')).toBe(dogUrl);
  });

  it('the unlock-all override makes art skins selectable', () => {
    setSettings({ mascot: 'dog', unlockAll: true });
    expect(mascotSrc('woodak')).toBe(dogUrl);
  });

  it('defaults to woodak when no selection is stored', () => {
    expect(mascotSrc('woodak')).toBe(woodakUrl);
  });
});
