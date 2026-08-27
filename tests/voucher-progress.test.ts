import { beforeEach, describe, expect, it } from 'vitest';
import { CORE_BOSS_IDS } from '../src/engine/bosses';
import { writeProfileValue } from '../src/ui/storage';
import {
  loadVoucherProgress,
  recordVoucherProgress,
  unlockedVoucherSet,
  VOUCHER_UNLOCK_RULES,
} from '../src/ui/voucherProgress';
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key) => mem.get(key) ?? null,
  setItem: (key, value) => { mem.set(key, value); },
  removeItem: (key) => { mem.delete(key); },
  clear: () => { mem.clear(); },
  key: (index) => [...mem.keys()][index] ?? null,
  get length() { return mem.size; },
};

beforeEach(() => mem.clear());

describe('voucher profile unlock progress', () => {
  it('unlocks upgraded vouchers at their data-driven thresholds', () => {
    for (let i = 0; i < 50; i++) {
      recordVoucherProgress({ kind: 'shopBuy', item: 'fable', spent: 3 });
    }
    expect(unlockedVoucherSet()).toContain('novel');
    expect(loadVoucherProgress().fableBought).toBe(50);
  });

  it('requires all 15 regular bosses for Portrait', () => {
    for (const id of CORE_BOSS_IDS) recordVoucherProgress({ kind: 'bossSeen', id });
    expect(unlockedVoucherSet()).toContain('portrait');
  });

  it('resets current-run voucher uses without erasing the lifetime maximum', () => {
    for (let i = 0; i < 10; i++) {
      recordVoucherProgress({ kind: 'voucherBuy', id: 'storyBook', spent: 10 });
    }
    expect(unlockedVoucherSet()).toContain('papyrus');
    recordVoucherProgress({ kind: 'newRun', handSize: 10, customSeed: false });
    expect(loadVoucherProgress().currentRunVoucherUses).toBe(0);
    expect(loadVoucherProgress().maxRunVoucherUses).toBe(10);
  });

  it('round-trips an unmeasured hand size without unlocking Picture Diary', () => {
    const rule = VOUCHER_UNLOCK_RULES.find(({ id }) => id === 'pictureDiary')!;
    const empty = loadVoucherProgress();
    expect(empty.lowestHandSize).toBeNull();
    expect(rule.met(empty)).toBe(false);

    localStorage.setItem('wj.vouchers', JSON.stringify(empty));
    const roundTripped = loadVoucherProgress();
    expect(roundTripped.lowestHandSize).toBeNull();
    expect(rule.met(roundTripped)).toBe(false);

    recordVoucherProgress({ kind: 'handSize', size: 8 });
    expect(unlockedVoucherSet()).toContain('pictureDiary');
  });

  it('does not advance or evaluate achievements in a custom-seeded run', () => {
    recordVoucherProgress({ kind: 'newRun', handSize: 8, customSeed: true });
    for (let i = 0; i < 50; i++) {
      recordVoucherProgress({ kind: 'shopBuy', item: 'fable', spent: 3 });
    }
    const progress = loadVoucherProgress();
    expect(progress.fableBought).toBe(0);
    expect(progress.lowestHandSize).toBeNull();
    expect(progress.unlocked).not.toContain('novel');
    expect(progress.unlocked).not.toContain('pictureDiary');
  });

  it('reconciles eligibility when resuming old custom and standard saves', () => {
    const legacy = loadVoucherProgress();
    localStorage.setItem('wj.vouchers', JSON.stringify(legacy));
    recordVoucherProgress({ kind: 'resumeRun', customSeed: true });
    recordVoucherProgress({ kind: 'shopBuy', item: 'fable', spent: 3 });
    expect(loadVoucherProgress().fableBought).toBe(0);

    recordVoucherProgress({ kind: 'resumeRun', customSeed: false });
    recordVoucherProgress({ kind: 'shopBuy', item: 'fable', spent: 3 });
    expect(loadVoucherProgress().fableBought).toBe(1);
  });

  it('does not unlock Portrait from duplicated corrupted boss history', () => {
    writeProfileValue('wj.vouchers', 1, {
      ...loadVoucherProgress(),
      bossesSeen: Array.from({ length: CORE_BOSS_IDS.length }, () => CORE_BOSS_IDS[0]),
    });
    recordVoucherProgress({ kind: 'tilesPlayed', count: 0 });
    expect(loadVoucherProgress().unlocked).not.toContain('portrait');
  });

  it('requires ten consecutive maximum-interest rounds', () => {
    for (let i = 0; i < 9; i++) {
      recordVoucherProgress({
        kind: 'blindCleared',
        ante: 1,
        bossId: null,
        interest: 5,
        interestCap: 5,
        handSize: 10,
      });
    }
    expect(unlockedVoucherSet()).not.toContain('householdLedger');
    recordVoucherProgress({
      kind: 'blindCleared',
      ante: 1,
      bossId: null,
      interest: 4,
      interestCap: 5,
      handSize: 10,
    });
    expect(loadVoucherProgress().interestStreak).toBe(0);
    for (let i = 0; i < 10; i++) {
      recordVoucherProgress({
        kind: 'blindCleared',
        ante: 1,
        bossId: null,
        interest: 5,
        interestCap: 5,
        handSize: 10,
      });
    }
    expect(unlockedVoucherSet()).toContain('householdLedger');
  });
});
