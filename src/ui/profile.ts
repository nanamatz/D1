import type { Lexicon } from '../engine/lexicon';
import { BALANCE } from '../engine/balance';
import type { Suit } from '../engine/types';
import { POUCH_IDS, isPouchUnlocked } from '../engine/pouches';
import { RECORD_IDS, isRecordUnlocked } from '../engine/records';
import { collectionSize, loadCollection, type Collection } from './collection';
import {
  activeProfile,
  readProfileValue,
  resetProfile,
  writeProfileValue,
  type ProfileSlot,
} from './storage';
import { loadLifetime, recordWinsForPouch, writeLifetime, type Lifetime } from './lifetime';
import { KNOWLEDGE_LETTER_HAND_IDS } from '../engine/letterHands';
import { UNLOCKS, loadPlayed } from './unlocks';
import { loadVoucherProgress, VOUCHER_UNLOCK_RULES } from './voucherProgress';
import {
  EMOJI_UNLOCK_RULES,
  loadEmojiUnlockProgress,
  revealAllEmojiTiles,
} from './emojiUnlocks';
import { ALL_JOKERS } from '../engine/jokers';
import {
  GOD_TITLE_DEF,
  REGISTER_TITLE_SUITS,
  profileTitleDef,
  type ProfileTitleDef,
  type ProfileTitleId,
} from './profileTitles';

export const PROFILE_NAME_MAX = 18;

export { REGISTER_TITLE_SUITS } from './profileTitles';

export interface RegisterTitleProgress {
  suit: Suit;
  discovered: number;
  total: number;
  /** 0–6 are count thresholds, 7 is full-register mastery. */
  tier: number | null;
  next: number | 'all' | null;
  complete: boolean;
}

export interface ProfileRegisterTitles {
  registers: Record<Suit, RegisterTitleProgress>;
  god: boolean;
}

export interface MainMenuProfileSnapshot {
  name: string;
  title: ProfileTitleDef | null;
  unseen: number;
}

export interface MainMenuProfileBase {
  name: string;
  equippedTitle: unknown;
  unlockAllApplied: boolean;
  unseen: number;
  words: readonly string[];
}

export interface ProfileViewSnapshot {
  collection: Collection;
  lifetime: Lifetime;
  rawEquippedTitle: unknown;
  registerTitles: ProfileRegisterTitles | null;
}

export const defaultProfileName = (slot: ProfileSlot): string => `P${slot}`;

/** Highest title tier for one register. Full current-register discovery wins
 * over count thresholds; an empty register cannot be mastered naturally. */
export function registerTitleTier(
  suit: Suit,
  discovered: number,
  total: number,
  revealAll = false,
): number | null {
  const thresholds = BALANCE.registerTitleThresholds[suit];
  if (revealAll || (total > 0 && discovered === total)) return thresholds.length;
  for (let index = thresholds.length - 1; index >= 0; index -= 1) {
    if (discovered >= thresholds[index]!) return index;
  }
  return null;
}

/** Pure title derivation from the current lexicon and one profile collection. */
export function deriveRegisterTitles(
  lexicon: Lexicon,
  collection: Readonly<Record<string, unknown>>,
  revealAll = false,
): ProfileRegisterTitles {
  return deriveRegisterTitlesFromWords(lexicon, Object.keys(collection), revealAll);
}

export function deriveRegisterTitlesFromWords(
  lexicon: Lexicon,
  words: Iterable<string>,
  revealAll = false,
): ProfileRegisterTitles {
  const totals = lexicon.registerTotals;
  const discovered: Record<Suit, number> = { standard: 0, formal: 0, slang: 0, vulgar: 0 };
  // Saved rows are normally normalized, but legacy case variants can resolve
  // to the same lexicon word and must still count once.
  const seen = new Set<string>();

  for (const word of words) {
    const entry = lexicon.lookup(word);
    if (!entry || seen.has(entry.word)) continue;
    seen.add(entry.word);
    discovered[entry.suit] += 1;
  }

  const registers = Object.fromEntries(REGISTER_TITLE_SUITS.map((suit) => {
    const found = revealAll ? totals[suit] : discovered[suit];
    const tier = registerTitleTier(suit, found, totals[suit], revealAll);
    const complete = tier === BALANCE.registerTitleThresholds[suit].length;
    const next = complete
      ? null
      : BALANCE.registerTitleThresholds[suit].find((threshold) => threshold > found) ?? 'all';
    return [suit, { suit, discovered: found, total: totals[suit], tier, next, complete }];
  })) as Record<Suit, RegisterTitleProgress>;

  return {
    registers,
    god: revealAll || REGISTER_TITLE_SUITS.every((suit) => registers[suit].complete),
  };
}

const validRawCollectionWords = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') return [];
  const words: string[] = [];
  for (const word in value) {
    if (!Object.hasOwn(value, word)) continue;
    const entry = (value as Record<string, unknown>)[word];
    if (
      (typeof entry === 'number' && Number.isFinite(entry))
      || (!!entry && typeof entry === 'object')
    ) words.push(word);
  }
  return words;
};

/** Slot-scoped raw snapshot loaded once for one mounted Main Menu. */
export function loadMainMenuProfileBase(
  slot: ProfileSlot = activeProfile(),
): MainMenuProfileBase {
  const lifetime = readProfileValue<{
    profileName?: unknown;
    equippedRegisterTitle?: unknown;
    unlockAllApplied?: unknown;
  }>('wj.lifetime', slot);
  const words = validRawCollectionWords(readProfileValue<unknown>('wj.collection', slot));
  const seen = readProfileValue<unknown>('wj.collectionSeen', slot);
  const seenCount = typeof seen === 'number' && Number.isFinite(seen) ? seen : 0;
  const storedName = typeof lifetime?.profileName === 'string' ? lifetime.profileName.trim() : '';
  return {
    name: storedName || defaultProfileName(slot),
    equippedTitle: lifetime?.equippedRegisterTitle,
    unlockAllApplied: lifetime?.unlockAllApplied === true,
    unseen: Math.max(0, words.length - seenCount),
    words,
  };
}

/** Resolve only the localized-title metadata when the lazy lexicon arrives. */
export function resolveMainMenuProfile(
  base: MainMenuProfileBase,
  lexicon: Lexicon | null,
): MainMenuProfileSnapshot {
  const titles = lexicon
    ? deriveRegisterTitlesFromWords(lexicon, base.words, base.unlockAllApplied)
    : null;
  return {
    name: base.name,
    unseen: base.unseen,
    title: titles ? unlockedProfileTitle(base.equippedTitle, titles) : null,
  };
}

/** Slot-aware storage adapter used by Profile previews. */
export function profileRegisterTitles(
  lexicon: Lexicon,
  slot: ProfileSlot = activeProfile(),
): ProfileRegisterTitles {
  return deriveRegisterTitles(lexicon, loadCollection(slot), loadLifetime(slot).unlockAllApplied);
}

/** One storage snapshot for a mounted Profile revision. Actions consume this
 * snapshot instead of reparsing a potentially large collection. */
export function loadProfileViewSnapshot(
  lexicon: Lexicon,
  slot: ProfileSlot = activeProfile(),
): ProfileViewSnapshot {
  const collection = loadCollection(slot);
  const lifetime = loadLifetime(slot, collection);
  const raw = readProfileValue<{ equippedRegisterTitle?: unknown }>('wj.lifetime', slot);
  return {
    collection,
    lifetime,
    rawEquippedTitle: raw?.equippedRegisterTitle,
    registerTitles: lifetime.profileCreated
      ? deriveRegisterTitles(lexicon, collection, lifetime.unlockAllApplied)
      : null,
  };
}

export function unlockedProfileTitle(
  id: unknown,
  titles: ProfileRegisterTitles,
): ProfileTitleDef | null {
  const definition = profileTitleDef(id);
  if (!definition) return null;
  if (definition.id === GOD_TITLE_DEF.id) return titles.god ? definition : null;
  const tier = titles.registers[definition.suit].tier;
  return tier !== null && definition.tier <= tier ? definition : null;
}

/** Effective cosmetic title for one explicit profile slot. */
export function effectiveProfileTitle(
  lexicon: Lexicon,
  slot: ProfileSlot = activeProfile(),
): ProfileTitleDef | null {
  const lifetime = loadLifetime(slot);
  return unlockedProfileTitle(lifetime.equippedRegisterTitle, profileRegisterTitles(lexicon, slot));
}

/** Select or clear a cosmetic title without affecting the active profile. */
export function selectProfileTitle(
  lexicon: Lexicon,
  slot: ProfileSlot,
  id: unknown,
): boolean {
  const collection = loadCollection(slot);
  const lifetime = loadLifetime(slot, collection);
  const titles = deriveRegisterTitles(lexicon, collection, lifetime.unlockAllApplied);
  return selectProfileTitleFromSnapshot(slot, id, lifetime, titles);
}

export function selectProfileTitleFromSnapshot(
  slot: ProfileSlot,
  id: unknown,
  lifetime: Lifetime,
  titles: ProfileRegisterTitles,
): boolean {
  if (!lifetime.profileCreated) return false;
  if (id !== null && !unlockedProfileTitle(id, titles)) return false;
  writeLifetime({ ...lifetime, equippedRegisterTitle: id as ProfileTitleId | null }, slot);
  return true;
}

/** Clear a stored semantic id that is no longer earned in the current lexicon. */
export function reconcileProfileTitle(lexicon: Lexicon, slot: ProfileSlot): boolean {
  const raw = readProfileValue<{ equippedRegisterTitle?: unknown }>('wj.lifetime', slot);
  const collection = loadCollection(slot);
  const lifetime = loadLifetime(slot, collection);
  const titles = deriveRegisterTitles(lexicon, collection, lifetime.unlockAllApplied);
  return reconcileProfileTitleFromSnapshot(slot, raw?.equippedRegisterTitle, lifetime, titles);
}

export function reconcileProfileTitleFromSnapshot(
  slot: ProfileSlot,
  rawEquippedTitle: unknown,
  lifetime: Lifetime,
  titles: ProfileRegisterTitles,
): boolean {
  if (
    rawEquippedTitle !== undefined
    && rawEquippedTitle !== null
    && profileTitleDef(rawEquippedTitle) === null
  ) {
    writeLifetime({ ...lifetime, equippedRegisterTitle: null }, slot);
    return true;
  }
  if (
    lifetime.equippedRegisterTitle === null
    || unlockedProfileTitle(lifetime.equippedRegisterTitle, titles)
  ) return false;
  writeLifetime({ ...lifetime, equippedRegisterTitle: null }, slot);
  return true;
}

/** Effective Collection count. Unlock-all stays compact instead of duplicating
 * tens of thousands of synthetic word-stat entries into every profile. */
export function profileCollectionSize(
  lexiconSize: number,
  slot: ProfileSlot = activeProfile(),
): number {
  return loadLifetime(slot).unlockAllApplied ? lexiconSize : collectionSize(slot);
}

/** Exact completion gate for totals that must stay secret until every current
 * lexicon entry is discovered. A stale/removed word cannot fake completion. */
export function isWordCollectionComplete(
  lexicon: Lexicon,
  slot: ProfileSlot = activeProfile(),
): boolean {
  if (loadLifetime(slot).unlockAllApplied) return true;
  const collection = loadCollection(slot);
  for (const word of lexicon.words()) {
    if (!Object.hasOwn(collection, word)) return false;
  }
  return true;
}

/** Word-threshold progress used by Starting Pouch gates. */
export function pouchUnlockWordCount(slot: ProfileSlot = activeProfile()): number {
  if (!loadLifetime(slot).unlockAllApplied) return collectionSize(slot);
  return Math.max(...Object.values(BALANCE.pouches.unlockWords));
}

/** True only when every currently implemented gate was earned normally. */
export function isProfileWorldComplete(
  slot: ProfileSlot,
  lexicon: Lexicon,
  snapshot?: { lifetime: Lifetime; collection: Collection },
): boolean {
  const collection = snapshot?.collection ?? loadCollection(slot);
  const lifetime = snapshot?.lifetime ?? loadLifetime(slot, collection);
  if (!lifetime.profileCreated || lifetime.unlockAllApplied) return false;
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
  return [...lexicon.words()].every((word) => Object.hasOwn(collection, word))
    && UNLOCKS.every((unlock) => played.has(unlock.id))
    && POUCH_IDS.every((id) => isPouchUnlocked(id, pouchProgress))
    && POUCH_IDS.every((pouchId) =>
      RECORD_IDS.every((id) => isRecordUnlocked(id, recordWinsForPouch(lifetime, pouchId))))
    && VOUCHER_UNLOCK_RULES.every((rule) => vouchers.has(rule.id))
    && EMOJI_UNLOCK_RULES.every((rule) => emojiTiles.has(rule.id))
    && KNOWLEDGE_LETTER_HAND_IDS.every((id) => lifetime.discoveredLetterHands.includes(id));
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
    jokerRecordStickers: Object.fromEntries(
      ALL_JOKERS.map((joker) => [joker.id, 'dvd' as const]),
    ),
    discoveredLetterHands: [...KNOWLEDGE_LETTER_HAND_IDS],
    unlockAllApplied: true,
    challengesDisabled: true,
  }, slot);
  return 'unlocked';
}
