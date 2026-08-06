import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_JOKERS } from '../src/engine/jokers';
import { availableJokerDefs } from '../src/engine/offers';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import { startBlind } from '../src/engine/loop';
import { canUseFable, useFable } from '../src/engine/fables';
import { canUseGambler } from '../src/engine/gamblers';
import {
  EMOJI_UNLOCK_RULES,
  loadEmojiUnlockProgress,
  recordEmojiUnlockEvent,
  unlockedEmojiSet,
  writeEmojiUnlockProgress,
} from '../src/ui/emojiUnlocks';
import { resetStorageCache } from '../src/ui/storage';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key) => mem.get(key) ?? null,
  setItem: (key, value) => { mem.set(key, value); },
  removeItem: (key) => { mem.delete(key); },
  clear: () => { mem.clear(); },
  key: (index) => [...mem.keys()][index] ?? null,
  get length() { return mem.size; },
};

beforeEach(() => {
  mem.clear();
  resetStorageCache();
});

describe('Emoji Tile profile unlocks', () => {
  it('starts with 54 ordinary tiles and all five Legendary tiles eligible', () => {
    const eligible = unlockedEmojiSet();
    const ordinary = ALL_JOKERS.filter((def) => def.rarity !== 'legendary');
    expect(EMOJI_UNLOCK_RULES).toHaveLength(70);
    expect(EMOJI_UNLOCK_RULES.filter((rule) =>
      ALL_JOKERS.find((def) => def.id === rule.id)?.rarity === 'common')).toHaveLength(11);
    expect(EMOJI_UNLOCK_RULES.filter((rule) =>
      ALL_JOKERS.find((def) => def.id === rule.id)?.rarity === 'uncommon')).toHaveLength(29);
    expect(EMOJI_UNLOCK_RULES.filter((rule) =>
      ALL_JOKERS.find((def) => def.id === rule.id)?.rarity === 'rare')).toHaveLength(30);
    expect(ordinary.filter((def) => eligible.has(def.id))).toHaveLength(54);
    expect(ALL_JOKERS.filter((def) => def.rarity === 'legendary' && eligible.has(def.id)))
      .toHaveLength(5);
    for (const rule of EMOJI_UNLOCK_RULES) {
      expect(en[rule.conditionKey as keyof typeof en], rule.id).toBeTruthy();
      expect(ko[rule.conditionKey as keyof typeof ko], rule.id).toBeTruthy();
    }
  });

  it('filters locked definitions from the headless offer pool', () => {
    const run = newRun('profile-pool');
    expect(availableJokerDefs(run, unlockedEmojiSet()).some((def) => def.id === 'miser'))
      .toBe(false);
    const progress = loadEmojiUnlockProgress();
    writeEmojiUnlockProgress({ ...progress, unlocked: [...progress.unlocked, 'miser'] });
    expect(availableJokerDefs(run, unlockedEmojiSet()).some((def) => def.id === 'miser'))
      .toBe(true);
  });

  it('applies the profile gate to direct creation but keeps Phoenix Legendary access', () => {
    const base = newRun('direct-create');
    const blind = startBlind(base, makeRng('direct-create-blind'));
    const fableRun = { ...base, consumables: ['fable14' as const] };
    expect(canUseFable('fable14', fableRun, blind, [], new Set())).toBe(false);
    expect(canUseFable('fable14', fableRun, blind, [], new Set(['miser']))).toBe(true);
    expect(useFable(
      'fable14',
      fableRun,
      blind,
      [],
      makeRng('only-miser'),
      new Set(['miser']),
    ).run.jokers[0]?.defId).toBe('miser');

    const phoenixRun = { ...base, consumables: ['phoenix' as const] };
    expect(canUseGambler('phoenix', phoenixRun, [], [], new Set())).toBe(true);
  });

  it('never advances achievements in a custom-seeded run', () => {
    const run = newRun('custom', { customSeed: true });
    for (let index = 0; index < 20; index += 1) {
      recordEmojiUnlockEvent({ kind: 'packOpened', run });
    }
    expect(loadEmojiUnlockProgress().values.copyEditor ?? 0).toBe(0);
    expect(loadEmojiUnlockProgress().unlocked).not.toContain('copyEditor');
  });

  it('resets one-run progress while retaining cumulative progress', () => {
    const first = newRun('first');
    recordEmojiUnlockEvent({ kind: 'newRun', run: first });
    for (let index = 0; index < 14; index += 1) {
      recordEmojiUnlockEvent({ kind: 'packOpened', run: first });
    }
    recordEmojiUnlockEvent({ kind: 'tileChanges', run: first, destroyed: [], created: [first.bag[0]!] });

    const second = newRun('second');
    recordEmojiUnlockEvent({ kind: 'newRun', run: second });
    const progress = loadEmojiUnlockProgress();
    expect(progress.values.copyEditor).toBe(0);
    expect(progress.values.livingType).toBe(1);
  });

  it('counts only committed Glass destruction', () => {
    const run = newRun('glass');
    const glass = { ...run.bag[0]!, material: 'glass' as const };
    recordEmojiUnlockEvent({ kind: 'newRun', run });
    recordEmojiUnlockEvent({ kind: 'tileChanges', run, destroyed: [], created: [] });
    expect(loadEmojiUnlockProgress().values.glasswork ?? 0).toBe(0);
    for (let index = 0; index < 3; index += 1) {
      recordEmojiUnlockEvent({ kind: 'tileChanges', run, destroyed: [glass], created: [] });
    }
    expect(loadEmojiUnlockProgress().unlocked).toContain('glasswork');
  });

  it('grants Rewrite only after the four-discard blind is cleared', () => {
    const run = newRun('rewrite');
    const blind = startBlind(run, makeRng('rewrite-blind'));
    recordEmojiUnlockEvent({ kind: 'newRun', run });
    for (let index = 0; index < 4; index += 1) {
      recordEmojiUnlockEvent({ kind: 'discardUsed', run, tiles: 1, slotsBlocked: 0 });
    }
    expect(loadEmojiUnlockProgress().unlocked).not.toContain('rewrite');
    recordEmojiUnlockEvent({
      kind: 'blindCleared',
      run,
      blind,
      judgment: { match: null, unison: null },
      interest: 0,
      acrostic: false,
    });
    expect(loadEmojiUnlockProgress().unlocked).toContain('rewrite');
  });
});
