/**
 * The one persistence path for the UI.
 *
 * Two backends, chosen at runtime:
 *   - web: localStorage, exactly as before
 *   - desktop: an in-memory cache seeded once at boot from the Electron bridge,
 *     with writes forwarded to the main process, which owns the files
 *
 * Reads MUST stay synchronous — readTips(), mascotSrc() and loadCollection() are
 * called during render. That is why the desktop path loads everything once and
 * serves reads from memory.
 *
 * Nothing here throws. A save is a convenience, never a reason to fail to boot.
 */

/**
 * Player progress. These move to files on desktop and sync via Steam Cloud.
 * Everything else (wj.profile, wj.settings, wj.lang, wj.sortMode) is a machine-local
 * preference and stays in localStorage everywhere — resolution and volume
 * following a player to another PC is an annoyance, not a feature.
 *
 * Adding a key? Decide which side it belongs on. `desktop/save-store.js` keeps a
 * copy of this list (it cannot import from src/); a test guards them against drift.
 */
export const SAVE_KEYS: ReadonlySet<string> = new Set([
  'wj.run',
  'wj.collection',
  'wj.collectionSeen',
  'wj.lifetime',
  'wj.unlocks',
  'wj.vouchers',
  'wj.emojiUnlocks',
  'wj.tutorial',
  'wj.tutorialIntro',
]);

export const PROFILE_SLOTS = [1, 2, 3] as const;
export type ProfileSlot = (typeof PROFILE_SLOTS)[number];

const PROFILE_KEY = 'wj.profile';
const PROFILE_ENVELOPE_VERSION = 1;

interface ProfileEnvelope {
  __wjProfileSlots: typeof PROFILE_ENVELOPE_VERSION;
  slots: Partial<Record<`${ProfileSlot}`, unknown>>;
}

/** What `desktop/preload.cjs` exposes on `window.wj`. */
export interface StorageBridge {
  /** key → JSON string, read from the save files at boot. */
  snapshot: Record<string, string>;
  /** True when the saves directory did not exist at boot — gates the one-time import. */
  fresh: boolean;
  write(key: string, json: string): void;
  remove(key: string): void;
  onSaveStatus?(listener: (ok: boolean) => void): void;
  syncSteam?(payload: import('./steamAchievements').SteamStatPayload): void;
  steamStatus?: SteamOwnershipStatus;
  decideSteamClaim?(decision: 'accept' | 'decline'): void;
  onSteamStatus?(listener: (status: SteamOwnershipStatus) => void): void;
}

export type SteamOwnershipStatus =
  | 'pending' | 'claim-required' | 'eligible' | 'unavailable'
  | 'mismatch' | 'invalid' | 'declined';
const STEAM_STATUSES = new Set<SteamOwnershipStatus>([
  'pending', 'claim-required', 'eligible', 'unavailable',
  'mismatch', 'invalid', 'declined',
]);
let steamStatus: SteamOwnershipStatus = 'unavailable';
const steamStatusListeners = new Set<() => void>();

export const steamOwnershipSnapshot = (): SteamOwnershipStatus => {
  getBridge();
  return steamStatus;
};
export const subscribeSteamOwnership = (listener: () => void): (() => void) => {
  steamStatusListeners.add(listener);
  return () => steamStatusListeners.delete(listener);
};
export const decideSteamClaim = (decision: 'accept' | 'decline'): void => {
  getBridge()?.decideSteamClaim?.(decision);
};
export const steamEvidenceEligible = (): boolean => {
  getBridge();
  return steamStatus === 'eligible';
};
export const steamAggregateSyncAllowed = (): boolean => {
  getBridge();
  return steamStatus === 'pending' || steamStatus === 'eligible';
};

export function syncSteamStats(payload: import('./steamAchievements').SteamStatPayload): void {
  getBridge()?.syncSteam?.(payload);
}

export function steamSyncAvailable(): boolean {
  return typeof getBridge()?.syncSteam === 'function';
}

let cache: Map<string, string> | null = null;
let boundBridge: StorageBridge | null = null;

export interface StorageFailure {
  backend: 'web' | 'desktop';
}

let storageFailure: StorageFailure | null = null;
const healthListeners = new Set<() => void>();

function setStorageFailure(next: StorageFailure | null): void {
  if (storageFailure?.backend === next?.backend) return;
  storageFailure = next;
  healthListeners.forEach((listener) => listener());
}

function clearStorageFailure(backend: StorageFailure['backend']): void {
  if (storageFailure?.backend === backend) setStorageFailure(null);
}

export function storageHealthSnapshot(): StorageFailure | null {
  return storageFailure;
}

export function subscribeStorageHealth(listener: () => void): () => void {
  healthListeners.add(listener);
  return () => healthListeners.delete(listener);
}

function getBridge(): StorageBridge | null {
  const bridge = (globalThis as { wj?: StorageBridge }).wj ?? null;
  if (bridge && bridge !== boundBridge) {
    boundBridge = bridge;
    steamStatus = STEAM_STATUSES.has(bridge.steamStatus as SteamOwnershipStatus)
      ? bridge.steamStatus as SteamOwnershipStatus : 'unavailable';
    bridge.onSteamStatus?.((status) => {
      if (!STEAM_STATUSES.has(status) || steamStatus === status) return;
      steamStatus = status;
      steamStatusListeners.forEach((listener) => listener());
    });
    bridge.onSaveStatus?.((ok) => {
      if (ok) clearStorageFailure('desktop');
      else setStorageFailure({ backend: 'desktop' });
    });
  }
  return bridge;
}

/**
 * Carry an existing localStorage profile into the files the first time the
 * desktop build runs. Gated on `fresh` (the saves directory was absent) rather
 * than on "this key has no file value" — the weaker rule would re-import on
 * every launch after any single key was cleared.
 *
 * The originals are DELETED once copied. `fresh` alone is not enough: deleting
 * the saves folder makes it true again, so a leftover localStorage copy would
 * resurrect the old profile — exactly what "delete my save and start over" must
 * not do. Only save keys are touched; preferences stay where they are.
 */
function migrate(bridge: StorageBridge, into: Map<string, string>): void {
  for (const key of SAVE_KEYS) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return; // no localStorage at all — nothing to migrate
    }
    if (raw !== null && !into.has(key)) {
      into.set(key, raw);
      bridge.write(key, raw);
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function getCache(bridge: StorageBridge): Map<string, string> {
  if (cache) return cache;
  cache = new Map(Object.entries(bridge.snapshot ?? {}));
  if (bridge.fresh) migrate(bridge, cache);
  return cache;
}

/** Test-only: drop the boot cache so a test can install a different bridge. */
export function resetStorageCache(): void {
  cache = null;
  boundBridge = null;
  setStorageFailure(null);
  steamStatus = 'unavailable';
  steamStatusListeners.clear();
}

/** The selected slot is a machine-local preference; the slot contents are saves. */
export function activeProfile(): ProfileSlot {
  try {
    const slot = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '1');
    return PROFILE_SLOTS.includes(slot as ProfileSlot) ? slot as ProfileSlot : 1;
  } catch {
    return 1;
  }
}

export function selectProfile(slot: ProfileSlot): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(slot));
    clearStorageFailure('web');
  } catch {
    setStorageFailure({ backend: 'web' });
  }
}

function profileEnvelope(raw: string | null): ProfileEnvelope | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<ProfileEnvelope>;
    return value?.__wjProfileSlots === PROFILE_ENVELOPE_VERSION
      && value.slots
      && typeof value.slots === 'object'
      ? value as ProfileEnvelope
      : null;
  } catch {
    return null;
  }
}

function readProfileRaw(raw: string | null, slot: ProfileSlot): string | null {
  const envelope = profileEnvelope(raw);
  if (envelope) {
    const value = envelope.slots[String(slot) as `${ProfileSlot}`];
    return value === undefined ? null : JSON.stringify(value);
  }
  // Every pre-profile save becomes P1 without a migration or copy.
  return slot === 1 ? raw : null;
}

function writeProfileRaw(raw: string | null, slot: ProfileSlot, json: string): string {
  const envelope = profileEnvelope(raw);
  // Keep the old flat format for P1-only saves. It remains human-readable and
  // avoids rewriting every existing profile merely because this build booted.
  if (!envelope && slot === 1) return json;

  const slots = { ...(envelope?.slots ?? {}) };
  if (!envelope && raw !== null) {
    try {
      slots['1'] = JSON.parse(raw);
    } catch {
      /* an unreadable legacy value was already unusable */
    }
  }
  try {
    slots[String(slot) as `${ProfileSlot}`] = JSON.parse(json);
  } catch {
    return raw ?? json;
  }
  return JSON.stringify({
    __wjProfileSlots: PROFILE_ENVELOPE_VERSION,
    slots,
  } satisfies ProfileEnvelope);
}

function readPhysicalRaw(key: string): string | null {
  const bridge = getBridge();
  if (bridge && SAVE_KEYS.has(key)) return getCache(bridge).get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePhysicalRaw(key: string, json: string): void {
  const bridge = getBridge();
  if (bridge && SAVE_KEYS.has(key)) {
    getCache(bridge).set(key, json);
    bridge.write(key, json);
    return;
  }
  try {
    localStorage.setItem(key, json);
    clearStorageFailure('web');
  } catch {
    setStorageFailure({ backend: 'web' });
  }
}

function removePhysical(key: string): void {
  const bridge = getBridge();
  if (bridge && SAVE_KEYS.has(key)) {
    getCache(bridge).delete(key);
    bridge.remove(key);
    return;
  }
  try {
    localStorage.removeItem(key);
    clearStorageFailure('web');
  } catch {
    setStorageFailure({ backend: 'web' });
  }
}

function readRaw(key: string): string | null {
  const raw = readPhysicalRaw(key);
  return SAVE_KEYS.has(key) ? readProfileRaw(raw, activeProfile()) : raw;
}

/** Read one progress value from an explicit slot without changing the active
 * profile. Profile-management screens use this to inspect inactive slots. */
export function readProfileValue<T>(key: string, slot: ProfileSlot): T | null {
  if (!SAVE_KEYS.has(key)) return null;
  const raw = readProfileRaw(readPhysicalRaw(key), slot);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Store an already-serialized value. Only `persist.ts` needs this — it holds
 *  the string already, for its dedupe check. */
export function writeRaw(key: string, json: string): void {
  const next = SAVE_KEYS.has(key)
    ? writeProfileRaw(readPhysicalRaw(key), activeProfile(), json)
    : json;
  writePhysicalRaw(key, next);
}

export function readValue<T>(key: string): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeValue(key: string, value: unknown): void {
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    return; // circular or otherwise unserializable — drop it
  }
  if (json === undefined) return; // JSON.stringify(undefined) is undefined
  writeRaw(key, json);
}

/** Write one progress value to an explicit slot without changing the active
 * profile. Preference keys are intentionally rejected: they are device-local. */
export function writeProfileValue(key: string, slot: ProfileSlot, value: unknown): void {
  if (!SAVE_KEYS.has(key)) return;
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    return;
  }
  if (json === undefined) return;
  writePhysicalRaw(key, writeProfileRaw(readPhysicalRaw(key), slot, json));
}

function removeProfileValue(key: string, slot: ProfileSlot): void {
  const raw = readPhysicalRaw(key);
  const envelope = profileEnvelope(raw);
  if (!envelope) {
    if (slot === 1) removePhysical(key);
    return;
  }

  const slots = { ...envelope.slots };
  delete slots[String(slot) as `${ProfileSlot}`];
  if (Object.keys(slots).length === 0) removePhysical(key);
  else {
    writePhysicalRaw(key, JSON.stringify({
      __wjProfileSlots: PROFILE_ENVELOPE_VERSION,
      slots,
    } satisfies ProfileEnvelope));
  }
}

export function remove(key: string): void {
  if (!SAVE_KEYS.has(key)) {
    removePhysical(key);
    return;
  }
  removeProfileValue(key, activeProfile());
}

/** Whether this slot contains any persisted progress. This recognizes profiles
 * created by builds that predate explicit profile metadata. */
export function profileHasData(slot: ProfileSlot): boolean {
  for (const key of SAVE_KEYS) {
    if (readProfileRaw(readPhysicalRaw(key), slot) !== null) return true;
  }
  return false;
}

/** Delete every progress key belonging to exactly one slot. */
export function resetProfile(slot: ProfileSlot): void {
  for (const key of SAVE_KEYS) removeProfileValue(key, slot);
}

export function resetActiveProfile(): void {
  resetProfile(activeProfile());
}
