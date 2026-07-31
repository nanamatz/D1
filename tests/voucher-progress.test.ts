import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadVoucherProgress,
  recordVoucherProgress,
  unlockedVoucherSet,
  VOUCHER_UNLOCK_RULES,
} from '../src/ui/voucherProgress';
import { CORE_BOSS_IDS } from '../src/engine/bosses';

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

  it('requires all 12 regular bosses for Portrait', () => {
    for (const id of CORE_BOSS_IDS) recordVoucherProgress({ kind: 'bossSeen', id });
    expect(unlockedVoucherSet()).toContain('portrait');
  });

  it('resets current-run voucher uses without erasing the lifetime maximum', () => {
    for (let i = 0; i < 10; i++) {
      recordVoucherProgress({ kind: 'voucherBuy', id: 'storyBook', spent: 10 });
    }
    expect(unlockedVoucherSet()).toContain('papyrus');
    recordVoucherProgress({ kind: 'newRun', handSize: 11 });
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

  it('requires ten consecutive maximum-interest rounds', () => {
    for (let i = 0; i < 9; i++) {
      recordVoucherProgress({
        kind: 'blindCleared',
        ante: 1,
        bossId: null,
        interest: 5,
        interestCap: 5,
        handSize: 11,
      });
    }
    expect(unlockedVoucherSet()).not.toContain('householdLedger');
    recordVoucherProgress({
      kind: 'blindCleared',
      ante: 1,
      bossId: null,
      interest: 4,
      interestCap: 5,
      handSize: 11,
    });
    expect(loadVoucherProgress().interestStreak).toBe(0);
    for (let i = 0; i < 10; i++) {
      recordVoucherProgress({
        kind: 'blindCleared',
        ante: 1,
        bossId: null,
        interest: 5,
        interestCap: 5,
        handSize: 11,
      });
    }
    expect(unlockedVoucherSet()).toContain('householdLedger');
  });
});
