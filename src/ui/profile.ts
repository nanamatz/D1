import type { Lexicon } from '../engine/lexicon';
import { BALANCE } from '../engine/balance';
import { POUCH_IDS, isPouchUnlocked } from '../engine/pouches';
import { RECORD_IDS, isRecordUnlocked } from '../engine/records';
import { collectionSize, loadCollection } from './collection';
import { activeProfile, resetProfile, writeProfileValue, type ProfileSlot } from './storage';
import { loadLifetime, recordWinsForPouch, writeLifetime } from './lifetime';
import { UNLOCKS, loadPlayed } from './unlocks';
import { loadVoucherProgress, VOUCHER_UNLOCK_RULES } from './voucherProgress';
import {
  EMOJI_UNLOCK_RULES,
  loadEmojiUnlockProgress,
  revealAllEmojiTiles,
} from './emojiUnlocks';

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

/** True only when every currently implemented gate was earned normally. */
export function isProfileWorldComplete(slot: ProfileSlot, lexicon: Lexicon): boolean {
  const lifetime = loadLifetime(slot);
  if (!lifetime.profileCreated || lifetime.unlockAllApplied) return false;

  const collection = loadCollection(slot);
  const discoveredWords = Object.keys(collection).length;
  if (discoveredWords < lexicon.size) return false;

  const pouchProgress = {
    discoveredWords,
    pouchWins: new Set(lifetime.pouchWins),
    recordWins: new Set(lifetime.recordWins),
  };
  const played = loadPlayed(slot);
  const vouchers = new Set(loadVoucherProgress(slot).unlocked);
  const emojiTiles = new Set(loadEmojiUnlockProgress(slot).unlocked);
  return [...lexicon.words()].every((word) => collection[word] !== undefined)
    && UNLOCKS.every((unlock) => played.has(unlock.id))
    && POUCH_IDS.every((id) => isPouchUnlocked(id, pouchProgress))
    && POUCH_IDS.every((pouchId) =>
      RECORD_IDS.every((id) => isRecordUnlocked(id, recordWinsForPouch(lifetime, pouchId))))
    && VOUCHER_UNLOCK_RULES.every((rule) => vouchers.has(rule.id))
    && EMOJI_UNLOCK_RULES.every((rule) => emojiTiles.has(rule.id));
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
    ...(lowestHandSize !== null ? { lowestHandSize } : {}),
    unlocked: VOUCHER_UNLOCK_RULES.map((rule) => rule.id),
  });
  revealAllEmojiTiles(slot);

  writeLifetime({
    ...lifetime,
    pouchWins: [...POUCH_IDS],
    recordWins: [...RECORD_IDS],
    recordWinsByPouch: Object.fromEntries(
      POUCH_IDS.map((pouchId) => [pouchId, [...RECORD_IDS]]),
    ),
    unlockAllApplied: true,
    challengesDisabled: true,
  }, slot);
  return 'unlocked';
}
