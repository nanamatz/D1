import { describe, it, expect, beforeEach } from 'vitest';
import { hasSeen, markSeen, resetTutorial, seenCount, loadTutorial, ENCOUNTERS, tutorialBus, type EncounterId } from '../src/ui/tutorial';
import { hasSeenIntro, markIntroSeen, resetIntro, INTRO_STEPS } from '../src/ui/tutorial';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

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
  resetIntro();
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

  it('markSeen keeps the first-seen timestamp on a repeat call', () => {
    markSeen('firstJoker', 1000);
    markSeen('firstJoker', 2000);
    expect(loadTutorial()['firstJoker']).toBe(1000);
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

describe('tutorial copy stays in sync with the registry', () => {
  it('every encounter has title+body in both locales', () => {
    for (const e of ENCOUNTERS) {
      for (const loc of [en, ko] as Record<string, string>[]) {
        expect(loc).toHaveProperty(`tutorial.${e.id}.title`);
        expect(loc).toHaveProperty(`tutorial.${e.id}.body`);
      }
    }
  });
});

describe('guided intro flag (A-1)', () => {
  it('hasSeenIntro is false until marked, true after, reset clears it', () => {
    resetIntro();
    expect(hasSeenIntro()).toBe(false);
    markIntroSeen();
    expect(hasSeenIntro()).toBe(true);
    resetIntro();
    expect(hasSeenIntro()).toBe(false);
  });

  it('INTRO_STEPS has 6 steps, each with a key and a selector', () => {
    expect(INTRO_STEPS.length).toBe(6);
    for (const s of INTRO_STEPS) {
      expect(s.key).toBeTruthy();
      expect(s.selector.startsWith('.')).toBe(true);
    }
    // keys are unique
    expect(new Set(INTRO_STEPS.map((s) => s.key)).size).toBe(6);
  });
});

describe('guided intro copy coverage', () => {
  it('every intro step + button has copy in both locales', () => {
    for (const loc of [en, ko] as Record<string, string>[]) {
      for (const s of INTRO_STEPS) {
        expect(loc).toHaveProperty(`intro.step.${s.key}.title`);
        expect(loc).toHaveProperty(`intro.step.${s.key}.body`);
      }
      for (const k of ['intro.next', 'intro.skip', 'intro.done']) {
        expect(loc).toHaveProperty(k);
      }
    }
  });
});
