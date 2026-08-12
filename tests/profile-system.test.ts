import { beforeEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { KNOWLEDGE_LETTER_HAND_IDS } from '../src/engine/letterHands';
import { makeLexicon } from '../src/engine/lexicon';
import { POUCH_IDS } from '../src/engine/pouches';
import { RECORD_IDS } from '../src/engine/records';
import { collectionSize } from '../src/ui/collection';
import {
  discoverLetterHand,
  loadDiscoveredLetterHands,
  loadLifetime,
  writeLifetime,
} from '../src/ui/lifetime';
import {
  createProfile,
  isProfileWorldComplete,
  pouchUnlockWordCount,
  profileCollectionSize,
  renameProfile,
  unlockAllProfile,
} from '../src/ui/profile';
import {
  readProfileValue,
  resetProfile,
  resetStorageCache,
  writeProfileValue,
} from '../src/ui/storage';
import { UNLOCKS, playedCount } from '../src/ui/unlocks';
import { loadVoucherProgress, VOUCHER_UNLOCK_RULES } from '../src/ui/voucherProgress';
import { EMOJI_UNLOCK_RULES, loadEmojiUnlockProgress } from '../src/ui/emojiUnlocks';

class MemStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

const lexicon = makeLexicon(['cat', 'dog', 'yellow'], {});

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStorage() as unknown as Storage;
  delete (globalThis as { wj?: unknown }).wj;
  resetStorageCache();
});

describe('profile creation and names', () => {
  it('starts with P1 and leaves P2/P3 empty until explicitly created', () => {
    expect(loadLifetime(1)).toMatchObject({ profileCreated: true, profileName: 'P1' });
    expect(loadLifetime(2)).toMatchObject({ profileCreated: false, profileName: '' });
    expect(loadLifetime(3)).toMatchObject({ profileCreated: false, profileName: '' });
  });

  it('uses P2/P3 for blank names and allows later renaming', () => {
    expect(createProfile(2, '   ')).toBe('P2');
    expect(createProfile(3, '  Writer  ')).toBe('Writer');
    expect(renameProfile(1, '  Reader  ')).toBe('Reader');
    expect(loadLifetime(1).profileName).toBe('Reader');
    expect(loadLifetime(2).profileName).toBe('P2');
    expect(loadLifetime(3).profileName).toBe('Writer');
  });

  it('resetting a secondary slot makes only that slot empty again', () => {
    createProfile(2, 'Second');
    createProfile(3, 'Third');
    resetProfile(2);
    expect(loadLifetime(2).profileCreated).toBe(false);
    expect(loadLifetime(3)).toMatchObject({ profileCreated: true, profileName: 'Third' });
    expect(loadLifetime(1)).toMatchObject({ profileCreated: true, profileName: 'P1' });
  });
});

describe('profile-scoped unlock all', () => {
  it('only warns on the first press and applies nothing', () => {
    createProfile(2, 'Second');

    expect(unlockAllProfile(1, lexicon)).toBe('warning');
    expect(loadLifetime(1)).toMatchObject({
      unlockAllWarned: true,
      unlockAllApplied: false,
      challengesDisabled: false,
    });
    expect(readProfileValue('wj.collection', 1)).toBeNull();
    expect(readProfileValue('wj.unlocks', 1)).toBeNull();
    expect(readProfileValue('wj.vouchers', 1)).toBeNull();
    expect(readProfileValue('wj.emojiUnlocks', 1)).toBeNull();
    expect(loadLifetime(1).pouchWins).toEqual([]);
    expect(loadLifetime(1).recordWins).toEqual([]);
    expect(loadLifetime(1).recordWinsByPouch).toEqual({});
    expect(loadLifetime(1).discoveredLetterHands).toEqual([]);

    expect(loadLifetime(2)).toMatchObject({
      profileName: 'Second',
      unlockAllWarned: false,
      unlockAllApplied: false,
    });
  });

  it('unlocks every implemented registry on the second press without touching P2', () => {
    createProfile(2, 'Second');
    expect(unlockAllProfile(1, lexicon)).toBe('warning');
    expect(unlockAllProfile(1, lexicon)).toBe('unlocked');

    expect(collectionSize(1)).toBe(0);
    expect(profileCollectionSize(lexicon.size, 1)).toBe(lexicon.size);
    expect(pouchUnlockWordCount(1)).toBeGreaterThanOrEqual(100);
    expect(readProfileValue('wj.collection', 1)).toBeNull();
    expect(playedCount(1)).toBe(UNLOCKS.length);
    expect(loadVoucherProgress(1).unlocked).toEqual(
      VOUCHER_UNLOCK_RULES.map((rule) => rule.id),
    );
    expect(loadEmojiUnlockProgress(1).unlocked).toEqual(
      EMOJI_UNLOCK_RULES.map((rule) => rule.id),
    );
    expect(loadLifetime(1).pouchWins).toEqual([...POUCH_IDS]);
    expect(loadLifetime(1).recordWins).toEqual([...RECORD_IDS]);
    expect(loadLifetime(1).recordWinsByPouch).toEqual(
      Object.fromEntries(POUCH_IDS.map((pouchId) => [pouchId, [...RECORD_IDS]])),
    );
    expect(loadLifetime(1).discoveredLetterHands).toEqual([...KNOWLEDGE_LETTER_HAND_IDS]);
    expect(loadLifetime(1).unlockAllApplied).toBe(true);
    expect(loadLifetime(1).challengesDisabled).toBe(true);

    expect(collectionSize(2)).toBe(0);
    expect(playedCount(2)).toBe(0);
    expect(loadVoucherProgress(2).unlocked).toEqual([]);
    expect(loadEmojiUnlockProgress(2).unlocked).toEqual([]);
    expect(loadLifetime(2)).toMatchObject({
      profileName: 'Second',
      pouchWins: [],
      recordWins: [],
      recordWinsByPouch: {},
      unlockAllWarned: false,
      unlockAllApplied: false,
      challengesDisabled: false,
    });
  });
});

describe('profile-scoped secret Word Hands', () => {
  it('records a discovery only in the selected profile slot', () => {
    createProfile(2, 'Second');
    discoverLetterHand('vowelless', 2);
    expect([...loadDiscoveredLetterHands(1)]).toEqual([]);
    expect([...loadDiscoveredLetterHands(2)]).toEqual(['vowelless']);
  });
});

describe('profile completion status', () => {
  it('recognizes a naturally completed world without treating unlock-all as natural', () => {
    const requiredWords = Math.max(...Object.values(BALANCE.pouches.unlockWords));
    const completeLexicon = makeLexicon(
      Array.from({ length: requiredWords }, (_, index) => `word${index}`),
      {},
    );
    const collection = Object.fromEntries(
      [...completeLexicon.words()].map((word) => [
        word,
        { firstPlayedAt: 1, plays: 1, bestScore: 1 },
      ]),
    );
    writeProfileValue('wj.collection', 1, collection);
    writeProfileValue('wj.unlocks', 1, UNLOCKS.map((unlock) => unlock.id));
    writeProfileValue('wj.vouchers', 1, {
      unlocked: VOUCHER_UNLOCK_RULES.map((rule) => rule.id),
    });
    writeProfileValue('wj.emojiUnlocks', 1, {
      version: 1,
      unlocked: EMOJI_UNLOCK_RULES.map((rule) => rule.id),
      values: {},
      run: null,
    });
    writeLifetime({
      ...loadLifetime(1),
      pouchWins: [...POUCH_IDS],
      recordWins: [...RECORD_IDS],
      recordWinsByPouch: Object.fromEntries(
        POUCH_IDS.map((pouchId) => [pouchId, [...RECORD_IDS]]),
      ),
      discoveredLetterHands: [...KNOWLEDGE_LETTER_HAND_IDS],
    }, 1);

    expect(isProfileWorldComplete(1, completeLexicon)).toBe(true);
    writeLifetime({ ...loadLifetime(1), unlockAllApplied: true }, 1);
    expect(isProfileWorldComplete(1, completeLexicon)).toBe(false);
  });
});
