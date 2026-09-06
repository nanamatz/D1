import { VOUCHER_REGISTRY } from '../engine/vouchers';
import type { VoucherId } from '../engine/types';
import { voucherDescKey } from './descriptions';
import { objectName, type Lang } from './i18n';

export interface VoucherCollectionCopy {
  name: string;
  body: string;
}

/**
 * Collection-only disclosure policy. Locked vouchers must not leak their real
 * name, effect, unlock condition, or progress through the ticket or tooltip.
 */
export function voucherCollectionCopy(
  id: VoucherId,
  locked: boolean,
  _lang: Lang,
  t: (key: string) => string,
): VoucherCollectionCopy {
  if (locked) {
    return {
      name: t('collection.voucher.undiscovered'),
      body: t('collection.voucher.undiscoveredDesc'),
    };
  }

  const voucher = VOUCHER_REGISTRY.get(id)!;
  return {
    name: objectName(t, 'voucher', voucher.id),
    body: t(voucherDescKey(id)),
  };
}
