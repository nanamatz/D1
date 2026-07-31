import type { Lexicon } from '../engine/lexicon';
import { BALANCE } from '../engine/balance';
import { POUCH_IDS } from '../engine/pouches';
import { RECORD_IDS } from '../engine/records';
import { collectionSize } from './collection';
import { activeProfile, resetProfile, writeProfileValue, type ProfileSlot } from './storage';
import { loadLifetime, writeLifetime } from './lifetime';
import { UNLOCKS } from './unlocks';
import { loadVoucherProgress, VOUCHER_UNLOCK_RULES } from './voucherProgress';

export const PROFILE_NAME_MAX = 18;

export const defaultProfileName = (slot: ProfileSlot): string => `P${slot}`;

/** Effective Collection count. Unlock-all stays compact instead of duplicating
 * tens of thousands of synthetic word-stat entries into every profile. */
export function profileCollectionSize(
  lexiconSize: number,
  slot: ProfileSlot = activeProfile(),
): number {
  return loadLifetime(slot).unlockAllApplied ? lexiconSize : collectionSize(slot);
}

/** Word-threshold progress used by Starting Pouch gates. */
export function pouchUnlockWordCount(slot: ProfileSlot = activeProfile()): number {
  if (!loadLifetime(slot).unlockAllApplied) return collectionSize(slot);
  return Math.max(...Object.values(BALANCE.pouches.unlockWords));
}

function normalizedName(slot: ProfileSlot, name: string): string {
  return name.trim().slice(0, PROFILE_NAME_MAX) || defaultProfileName(slot);
}

export function createProfile(slot: ProfileSlot, name: string): string {
  const current = loadLifetime(slot);
  if (current.profileCreated) return current.profileName;

  resetProfile(slot);
  const profileName = normalizedName(slot, name);
  writeLifetime({
    ...loadLifetime(slot),
    profileCreated: true,
    profileName,
  }, slot);
  return profileName;
}

export function renameProfile(slot: ProfileSlot, name: string): string {
  const current = loadLifetime(slot);
  if (!current.profileCreated) return '';
  const profileName = normalizedName(slot, name);
  writeLifetime({ ...current, profileName }, slot);
  return profileName;
}

export type UnlockAllResult = 'warning' | 'unlocked' | 'already' | 'missing';

/**
 * First press only records that this profile has seen the warning. A later press
 * fills every implemented progression registry in exactly the requested slot.
 */
export function unlockAllProfile(slot: ProfileSlot, lexicon: Lexicon): UnlockAllResult {
  const lifetime = loadLifetime(slot);
  if (!lifetime.profileCreated) return 'missing';
  if (!lifetime.unlockAllWarned) {
    writeLifetime({ ...lifetime, unlockAllWarned: true }, slot);
    return 'warning';
  }
  if (lifetime.unlockAllApplied) return 'already';

  writeProfileValue('wj.collectionSeen', slot, lexicon.size);
  writeProfileValue('wj.unlocks', slot, UNLOCKS.map((unlock) => unlock.id));

  const { lowestHandSize, ...voucherProgress } = loadVoucherProgress(slot);
  writeProfileValue('wj.vouchers', slot, {
    ...voucherProgress,
    ...(Number.isFinite(lowestHandSize) ? { lowestHandSize } : {}),
    unlocked: VOUCHER_UNLOCK_RULES.map((rule) => rule.id),
  });

  writeLifetime({
    ...lifetime,
    pouchWins: [...POUCH_IDS],
    recordWins: [...RECORD_IDS],
    unlockAllApplied: true,
    challengesDisabled: true,
  }, slot);
  return 'unlocked';
}
