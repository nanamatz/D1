import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { VOUCHER_REGISTRY } from '../src/engine/vouchers';
import type { VoucherId } from '../src/engine/types';
import { voucherDescKey } from '../src/ui/descriptions';
import { VOUCHER_UNLOCK_RULES } from '../src/ui/voucherProgress';
import { voucherCollectionCopy } from '../src/ui/voucherCollection';

const translate = (dict: Record<string, string>) => (key: string): string => dict[key] ?? key;

describe('Voucher Collection disclosure', () => {
  it('hides every locked voucher name, effect, and unlock condition in Korean', () => {
    const t = translate(ko as Record<string, string>);
    for (const rule of VOUCHER_UNLOCK_RULES) {
      const voucher = VOUCHER_REGISTRY.get(rule.id)!;
      const copy = voucherCollectionCopy(rule.id, true, 'ko', t);

      expect(copy).toEqual({
        name: '발견되지 않음',
        body: '시드되지 않은 런에서 이 바우처를 교환하여 기능을 알아보세요',
      });
      expect(copy.name).not.toBe(voucher.nameKo);
      expect(copy.body).not.toContain(t(voucherDescKey(rule.id)));
      expect(copy.body).not.toContain(rule.conditionKo);
    }
  });

  it('uses the matching undiscovered copy in English', () => {
    const t = translate(en as Record<string, string>);
    const copy = voucherCollectionCopy('novel' as VoucherId, true, 'en', t);
    expect(copy).toEqual({
      name: 'Undiscovered',
      body: 'Redeem this voucher in an unseeded run to discover what it does.',
    });
  });

  it('still reveals unlocked voucher names and effects', () => {
    const t = translate(ko as Record<string, string>);
    const copy = voucherCollectionCopy('novel', false, 'ko', t);
    expect(copy.name).toBe(VOUCHER_REGISTRY.get('novel')!.nameKo);
    expect(copy.body).toBe(t(voucherDescKey('novel')));
  });
});
