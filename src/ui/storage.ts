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
 * Everything else (wj.settings, wj.lang, wj.sortMode) is a machine-local
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
  'wj.tutorial',
  'wj.tutorialIntro',
]);

/** What `desktop/preload.cjs` exposes on `window.wj`. */
export interface StorageBridge {
  /** key → JSON string, read from the save files at boot. */
  snapshot: Record<string, string>;
  /** True when the saves directory did not exist at boot — gates the one-time import. */
  fresh: boolean;
  write(key: string, json: string): void;
  remove(key: string): void;
}

let cache: Map<string, string> | null = null;

function getBridge(): StorageBridge | null {
  return (globalThis as { wj?: StorageBridge }).wj ?? null;
}

/**
 * Carry an existing localStorage profile into the files the first time the
 * desktop build runs. Gated on `fresh` (the saves directory was absent) rather
 * than on "this key has no file value" — the weaker rule would resurrect stale
 * localStorage every time a player deliberately deleted their save.
 */
function migrate(bridge: StorageBridge, into: Map<string, string>): void {
  for (const key of SAVE_KEYS) {
    if (into.has(key)) continue;
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return; // no localStorage at all — nothing to migrate
    }
    if (raw === null) continue;
    into.set(key, raw);
    bridge.write(key, raw);
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
}

function readRaw(key: string): string | null {
  const bridge = getBridge();
  if (bridge && SAVE_KEYS.has(key)) return getCache(bridge).get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Store an already-serialized value. Only `persist.ts` needs this — it holds
 *  the string already, for its dedupe check. */
export function writeRaw(key: string, json: string): void {
  const bridge = getBridge();
  if (bridge && SAVE_KEYS.has(key)) {
    getCache(bridge).set(key, json);
    bridge.write(key, json);
    return;
  }
  try {
    localStorage.setItem(key, json);
  } catch {
    /* quota / privacy mode — the value just stays session-only */
  }
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

export function remove(key: string): void {
  const bridge = getBridge();
  if (bridge && SAVE_KEYS.has(key)) {
    getCache(bridge).delete(key);
    bridge.remove(key);
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
