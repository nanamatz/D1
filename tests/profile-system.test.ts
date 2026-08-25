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
  deriveRegisterTitles,
  effectiveProfileTitle,
  isProfileWorldComplete,
  isWordCollectionComplete,
  loadProfileViewSnapshot,
  pouchUnlockWordCount,
  profileCollectionSize,
  profileRegisterTitles,
  reconcileProfileTitle,
  reconcileProfileTitleFromSnapshot,
  registerTitleTier,
  renameProfile,
  selectProfileTitle,
  selectProfileTitleFromSnapshot,
  unlockAllProfile,
} from '../src/ui/profile';
import {
  activeProfile,
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

class CountingStorage extends MemStorage {
  collectionReads = 0;
  override getItem(key: string) {
    if (key === 'wj.collection') this.collectionReads += 1;
    return super.getItem(key);
  }
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
    writeLifetime({
      ...loadLifetime(1),
      jokerRecordStickers: { bookworm: 'redLp' },
      completedChallenges: ['redPen'],
    }, 1);
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
    expect(loadLifetime(1).jokerRecordStickers).toEqual({ bookworm: 'redLp' });
    expect(loadLifetime(1).discoveredLetterHands).toEqual([...KNOWLEDGE_LETTER_HAND_IDS]);
    expect(loadLifetime(1).unlockAllApplied).toBe(true);
    expect(loadLifetime(1).challengesDisabled).toBe(true);
    expect(loadLifetime(1).completedChallenges).toEqual(['redPen']);
    const titles = profileRegisterTitles(lexicon, 1);
    expect(titles.god).toBe(true);
    expect(Object.values(titles.registers).every((title) => title.complete)).toBe(true);

    expect(collectionSize(2)).toBe(0);
    expect(playedCount(2)).toBe(0);
    expect(loadVoucherProgress(2).unlocked).toEqual([]);
    expect(loadEmojiUnlockProgress(2).unlocked).toEqual([]);
    expect(loadLifetime(2)).toMatchObject({
      profileName: 'Second',
      pouchWins: [],
      recordWins: [],
      recordWinsByPouch: {},
      jokerRecordStickers: {},
      unlockAllWarned: false,
      unlockAllApplied: false,
      challengesDisabled: false,
      completedChallenges: [],
    });
  });
});

describe('profile register titles', () => {
  it('parses a large collection once per view snapshot and reuses it for title actions', () => {
    const storage = new CountingStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage as unknown as Storage;
    resetStorageCache();
    storage.setItem('wj.collection', JSON.stringify(Object.fromEntries(
      Array.from({ length: 100_000 }, (_, index) => [`word${index}`, index + 1]),
    )));
    storage.collectionReads = 0;

    const snapshot = loadProfileViewSnapshot(makeLexicon([], {}), 1);
    expect(Object.keys(snapshot.collection)).toHaveLength(100_000);
    expect(storage.collectionReads).toBe(1);
    expect(snapshot.registerTitles).not.toBeNull();

    expect(selectProfileTitleFromSnapshot(
      1,
      null,
      snapshot.lifetime,
      snapshot.registerTitles!,
    )).toBe(true);
    expect(reconcileProfileTitleFromSnapshot(
      1,
      'retired.title',
      snapshot.lifetime,
      snapshot.registerTitles!,
    )).toBe(true);
    expect(storage.collectionReads).toBe(1);
  });

  it('awards every count tier exactly at its BALANCE threshold', () => {
    for (const suit of ['standard', 'formal', 'slang', 'vulgar'] as const) {
      BALANCE.registerTitleThresholds[suit].forEach((threshold, index) => {
        expect(registerTitleTier(suit, threshold - 1, 200_000)).toBe(
          index === 0 ? null : index - 1,
        );
        expect(registerTitleTier(suit, threshold, 200_000)).toBe(index);
      });
    }
  });

  it('awards full-register titles and God only after all four non-empty registers', () => {
    const allRegisters = makeLexicon([], {
      plain: { suit: 'standard', pos: ['noun'] },
      edict: { suit: 'formal', pos: ['noun'] },
      lit: { suit: 'slang', pos: ['adjective'] },
      damn: { suit: 'vulgar', pos: ['interjection'] },
    });
    const complete = deriveRegisterTitles(allRegisters, {
      plain: 1, edict: 1, lit: 1, damn: 1,
    });
    expect(complete.god).toBe(true);
    expect(Object.values(complete.registers).map((title) => title.tier)).toEqual([7, 7, 7, 7]);

    const noEmptyGod = deriveRegisterTitles(makeLexicon(['plain'], {}), { plain: 1 });
    expect(noEmptyGod.god).toBe(false);
    expect(noEmptyGod.registers.formal.complete).toBe(false);
  });

  it('uses unique current-lexicon words and ignores stale collection rows', () => {
    const current = makeLexicon([], {
      plain: { suit: 'standard', pos: ['noun'] },
      edict: { suit: 'formal', pos: ['noun'] },
    });
    const titles = deriveRegisterTitles(current, { edict: 1, removed: 1 });
    expect(titles.registers.formal.discovered).toBe(1);
    expect(titles.registers.standard.discovered).toBe(0);
    expect(Object.values(titles.registers).reduce((sum, title) => sum + title.discovered, 0)).toBe(1);
  });

  it('counts only own collection keys without scanning all lexicon words', () => {
    const base = makeLexicon([], {
      constructor: { suit: 'standard' as const, pos: ['noun' as const] },
      plain: { suit: 'standard' as const, pos: ['noun' as const] },
    });
    let scans = 0;
    const current = {
      ...base,
      words() {
        scans += 1;
        throw new Error('Profile derivation must use precomputed register totals');
      },
    };

    expect(deriveRegisterTitles(current, {}).registers.standard.discovered).toBe(0);
    expect(deriveRegisterTitles(current, { constructor: 1 }).registers.standard.discovered).toBe(1);
    expect(scans).toBe(0);
  });

  it('does not treat Object.prototype keys as collected words', () => {
    const current = makeLexicon([], {
      constructor: { suit: 'standard' as const, pos: ['noun' as const] },
    });

    expect(isWordCollectionComplete(current, 1)).toBe(false);
    writeProfileValue('wj.collection', 1, {
      constructor: { firstPlayedAt: 1, plays: 1, bestScore: 1 },
    });
    expect(isWordCollectionComplete(current, 1)).toBe(true);
  });

  it('loads legacy collection rows from the exact previewed profile slot', () => {
    const current = makeLexicon([], {
      curse: { suit: 'vulgar', pos: ['noun'] },
      taboo: { suit: 'vulgar', pos: ['noun'] },
      street: { suit: 'slang', pos: ['noun'] },
    });
    localStorage.setItem('wj.collection', JSON.stringify({ curse: 500 }));
    resetStorageCache();
    createProfile(2, 'Second');
    writeProfileValue('wj.collection', 2, { street: 600 });

    const p1 = profileRegisterTitles(current, 1);
    const p2 = profileRegisterTitles(current, 2);
    expect(p1.registers.vulgar.discovered).toBe(1);
    expect(p1.registers.slang.discovered).toBe(0);
    expect(p2.registers.vulgar.discovered).toBe(0);
    expect(p2.registers.slang.discovered).toBe(1);
  });

  it('treats Reveal All as every register title and God without synthetic words', () => {
    const titles = deriveRegisterTitles(makeLexicon(['plain'], {}), {}, true);
    expect(titles.god).toBe(true);
    expect(Object.values(titles.registers).every((title) => title.tier === 7)).toBe(true);
  });

  it('equips only earned semantic ids, keeps lower tiers, and clears with null', () => {
    const current = makeLexicon(
      Array.from({ length: 101 }, (_, index) => `word${index}`),
      {},
    );
    const words = [...current.words()];
    writeProfileValue('wj.collection', 1, Object.fromEntries(words.slice(0, 50).map((word) => [word, 1])));

    expect(selectProfileTitle(current, 1, 'standard.speller')).toBe(false);
    expect(selectProfileTitle(current, 1, 'standard.reader')).toBe(true);
    expect(loadLifetime(1).equippedRegisterTitle).toBe('standard.reader');

    writeProfileValue('wj.collection', 1, Object.fromEntries(words.slice(0, 100).map((word) => [word, 1])));
    expect(effectiveProfileTitle(current, 1)?.id).toBe('standard.reader');
    expect(selectProfileTitle(current, 1, 'standard.speller')).toBe(true);
    expect(selectProfileTitle(current, 1, 'retired.title')).toBe(false);
    expect(loadLifetime(1).equippedRegisterTitle).toBe('standard.speller');
    expect(selectProfileTitle(current, 1, null)).toBe(true);
    expect(loadLifetime(1).equippedRegisterTitle).toBeNull();
  });

  it('writes an inactive preview slot only and Reveal All never auto-equips', () => {
    const current = makeLexicon(['plain'], {});
    createProfile(2, 'Second');
    createProfile(3, 'Third');
    writeProfileValue('wj.collection', 2, { plain: 1 });

    expect(activeProfile()).toBe(1);
    expect(selectProfileTitle(current, 2, 'standard.master')).toBe(true);
    expect(activeProfile()).toBe(1);
    expect(loadLifetime(2).equippedRegisterTitle).toBe('standard.master');
    expect(loadLifetime(1).equippedRegisterTitle).toBeNull();
    expect(loadLifetime(3).equippedRegisterTitle).toBeNull();

    writeProfileValue('wj.collection', 1, { plain: 1 });
    expect(selectProfileTitle(current, 1, 'standard.master')).toBe(true);
    expect(unlockAllProfile(1, current)).toBe('warning');
    expect(unlockAllProfile(1, current)).toBe('unlocked');
    expect(loadLifetime(1).equippedRegisterTitle).toBe('standard.master');
    expect(selectProfileTitle(current, 1, 'god')).toBe(true);
    expect(effectiveProfileTitle(current, 1)?.id).toBe('god');
  });

  it('falls back to no title and reconciles a no-longer-earned stored selection', () => {
    const current = makeLexicon(
      Array.from({ length: 51 }, (_, index) => `word${index}`),
      {},
    );
    const words = [...current.words()];
    writeProfileValue('wj.collection', 1, Object.fromEntries(words.slice(0, 50).map((word) => [word, 1])));
    expect(selectProfileTitle(current, 1, 'standard.reader')).toBe(true);

    writeProfileValue('wj.collection', 1, {});
    expect(effectiveProfileTitle(current, 1)).toBeNull();
    expect(reconcileProfileTitle(current, 1)).toBe(true);
    expect(loadLifetime(1).equippedRegisterTitle).toBeNull();
    expect(reconcileProfileTitle(current, 1)).toBe(false);

    writeProfileValue('wj.lifetime', 1, {
      ...loadLifetime(1),
      equippedRegisterTitle: 'retired.title',
    });
    expect(reconcileProfileTitle(current, 1)).toBe(true);
    expect(readProfileValue<{ equippedRegisterTitle: unknown }>('wj.lifetime', 1)
      ?.equippedRegisterTitle).toBeNull();
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
      Array.from({ length: requiredWords }, (_, index) => index === 0 ? 'constructor' : `word${index}`),
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
    const { constructor: omitted, ...withoutConstructor } = collection;
    expect(omitted).toBeDefined();
    writeProfileValue('wj.collection', 1, withoutConstructor);
    expect(isProfileWorldComplete(1, completeLexicon)).toBe(false);
    writeProfileValue('wj.collection', 1, collection);
    writeLifetime({ ...loadLifetime(1), unlockAllApplied: true }, 1);
    expect(isProfileWorldComplete(1, completeLexicon)).toBe(false);
  });
});
