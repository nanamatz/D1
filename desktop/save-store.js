/**
 * Save files for the desktop build.
 *
 * Two files under <userData>/saves/:
 *   run.json      — the in-progress run (wj.run), rewritten on nearly every action
 *   profile.json  — collection, lifetime stats, unlocks, vouchers, tutorial flags
 *
 * They are split because src/ui/persist.ts DISCARDS a run whose schema version
 * moved. Sharing one file would mean a run-schema bump destroys the collection
 * and the lifetime stats.
 *
 * Files hold parsed, human-readable JSON. The bridge carries JSON strings, so
 * this module parses on write and re-stringifies on read.
 *
 * Nothing here throws. A failed save must never break the game.
 */
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

/**
 * Duplicated from src/ui/storage.ts — desktop/ must not import from src/
 * (dependency direction is one-way). tests/desktop-save-store.test.mjs fails if
 * the two lists drift apart.
 */
export const SAVE_KEYS = new Set([
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

/** File-format version. NOT the game data version — wj.run keeps its own. */
const SCHEMA = 1;

/** Collapsing bursts: wj.run is written on nearly every action. */
const DEBOUNCE_MS = 300;

export function validSteamOwner(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    value.version === 1 && typeof value.steamId64 === 'string' &&
    /^[1-9]\d{16,19}$/.test(value.steamId64) && Object.keys(value).length === 2;
}

function loadSaveDocument(file) {
  for (const candidate of [file, file + '.bak']) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const entries = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'schema' || key === 'steamOwner') continue;
        entries[key] = JSON.stringify(value);
      }
      return {
        entries,
        ownerRaw: Object.hasOwn(parsed, 'steamOwner') ? parsed.steamOwner : undefined,
        ownerState: !Object.hasOwn(parsed, 'steamOwner') ? 'unowned'
          : validSteamOwner(parsed.steamOwner) ? 'owned' : 'invalid',
      };
    } catch {
      /* try backup */
    }
  }
  return { entries: {}, ownerRaw: undefined, ownerState: 'unowned' };
}

/**
 * @param {string} file
 * @returns {Record<string, string>} key → JSON string; {} when missing or corrupt
 */
export function loadSaveFile(file) {
  return loadSaveDocument(file).entries;
}

/**
 * Atomic write with one backup generation:
 *   1. write file.tmp + fsync
 *   2. copy the current file to file.bak
 *   3. rename file.tmp over the current file
 * A crash at any point leaves either the old complete file or the new one.
 *
 * @param {string} file
 * @param {Record<string, string>} entries key → JSON string
 */
function writeSaveFile(file, entries, ownerRaw, backupCurrent) {
  const doc = { schema: SCHEMA };
  if (ownerRaw !== undefined) doc.steamOwner = ownerRaw;
  for (const [key, json] of Object.entries(entries)) {
    try {
      doc[key] = JSON.parse(json);
    } catch {
      /* drop this one key rather than write a broken file */
    }
  }

  const tmp = file + '.tmp';
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    const fd = openSync(tmp, 'w');
    try {
      writeFileSync(fd, JSON.stringify(doc, null, 2), 'utf8');
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    if (backupCurrent && existsSync(file)) copyFileSync(file, file + '.bak');
    renameSync(tmp, file);
    return true;
  } catch {
    /* disk full, permissions, a watcher holding a handle — keep playing */
    return false;
  }
}

export function saveSaveFile(file, entries, ownerRaw) {
  return writeSaveFile(file, entries, ownerRaw, true);
}

/** wj.run lives alone; everything else is profile data. */
function fileNameFor(key) {
  return key === 'wj.run' ? 'run' : 'profile';
}

/**
 * The live store the main process talks to.
 * @param {string} dir the saves directory
 */
export function createSaveStore(dir, onStatus = () => {}) {
  // Captured before any write creates the directory — gates the one-time import.
  const fresh = !existsSync(dir);

  const pathFor = (name) => path.join(dir, name + '.json');
  const profileDoc = loadSaveDocument(pathFor('profile'));
  const data = {
    run: loadSaveFile(pathFor('run')),
    profile: profileDoc.entries,
  };
  let ownerRaw = profileDoc.ownerRaw;
  let ownerState = profileDoc.ownerState;
  /** @type {Record<string, ReturnType<typeof setTimeout> | undefined>} */
  const timers = {};
  const healthy = { run: true, profile: true };

  function writeNow(name) {
    clearTimeout(timers[name]);
    timers[name] = undefined;
    const before = healthy.run && healthy.profile;
    healthy[name] = saveSaveFile(pathFor(name), data[name], name === 'profile' ? ownerRaw : undefined);
    const after = healthy.run && healthy.profile;
    if (before !== after) onStatus(after);
  }

  function schedule(name) {
    clearTimeout(timers[name]);
    timers[name] = setTimeout(() => writeNow(name), DEBOUNCE_MS);
  }

  return {
    fresh,

    snapshot: () => ({ ...data.run, ...data.profile }),

    steamOwner: () => ({ state: ownerState, ...(ownerState === 'owned' ? { owner: ownerRaw } : {}) }),

    claimSteamOwner(steamId64) {
      const next = { version: 1, steamId64 };
      if (!validSteamOwner(next) || ownerState !== 'unowned') return false;
      clearTimeout(timers.profile);
      timers.profile = undefined;
      const file = pathFor('profile');
      // Establish a fail-closed marker through the ordinary backup transition.
      // From here onward any crash/reload sees invalid, never a half-claimed owner.
      const incomplete = { version: 1, claimIncomplete: true };
      if (!saveSaveFile(file, data.profile, incomplete)) return false;
      ownerRaw = incomplete;
      ownerState = 'invalid';
      // Finalize backup first, then primary, without creating another generation.
      if (!writeSaveFile(file + '.bak', data.profile, next, false)) return false;
      if (!writeSaveFile(file, data.profile, next, false)) return false;
      ownerRaw = next;
      ownerState = 'owned';
      return true;
    },

    set(key, json) {
      if (!SAVE_KEYS.has(key) || typeof json !== 'string') return;
      const name = fileNameFor(key);
      data[name][key] = json;
      schedule(name);
    },

    remove(key) {
      if (!SAVE_KEYS.has(key)) return;
      const name = fileNameFor(key);
      delete data[name][key];
      schedule(name);
    },

    /** Write anything pending immediately. Called on quit. */
    flush() {
      for (const name of ['run', 'profile']) {
        if (timers[name] !== undefined) writeNow(name);
      }
    },
  };
}
