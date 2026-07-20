import { describe, it, expect, beforeEach } from 'vitest';
import { hasSeen, markSeen, resetTutorial, seenCount, ENCOUNTERS, tutorialBus, type EncounterId } from '../src/ui/tutorial';

// jsdom is not configured project-wide; provide a minimal localStorage shim for
// this file (the store only uses getItem/setItem/removeItem).
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: () => null, length: 0,
  } as Storage;
  resetTutorial();
});

describe('tutorial seen-flags store', () => {
  it('hasSeen is false until markSeen, true after (persisted)', () => {
    expect(hasSeen('firstGibberish')).toBe(false);
    markSeen('firstGibberish');
    expect(hasSeen('firstGibberish')).toBe(true);
    expect(seenCount()).toBe(1);
  });

  it('markSeen is idempotent (no double count)', () => {
    markSeen('firstPack');
    markSeen('firstPack');
    expect(seenCount()).toBe(1);
  });

  it('resetTutorial clears all flags', () => {
    markSeen('firstVoucher');
    resetTutorial();
    expect(hasSeen('firstVoucher')).toBe(false);
    expect(seenCount()).toBe(0);
  });

  it('registry has all 13 encounters with unique ids and a group', () => {
    expect(ENCOUNTERS.length).toBe(13);
    const ids = new Set(ENCOUNTERS.map((e) => e.id));
    expect(ids.size).toBe(13);
    for (const e of ENCOUNTERS) expect(e.group).toBeTruthy();
  });
});

describe('tutorialBus', () => {
  it('fire notifies subscribers; unsubscribe stops them', () => {
    const seen: EncounterId[] = [];
    const off = tutorialBus.subscribe((id) => seen.push(id));
    tutorialBus.fire('firstGibberish');
    expect(seen).toEqual(['firstGibberish']);
    off();
    tutorialBus.fire('firstPack');
    expect(seen).toEqual(['firstGibberish']); // no longer receiving
  });
});
