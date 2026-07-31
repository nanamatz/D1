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
  'wj.tutorial',
  'wj.tutorialIntro',
]);

/** File-format version. NOT the game data version — wj.run keeps its own. */
const SCHEMA = 1;

/** Collapsing bursts: wj.run is written on nearly every action. */
const DEBOUNCE_MS = 300;

/**
 * @param {string} file
 * @returns {Record<string, string>} key → JSON string; {} when missing or corrupt
 */
export function loadSaveFile(file) {
  for (const candidate of [file, file + '.bak']) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const out = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'schema') continue;
        out[key] = JSON.stringify(value);
      }
      return out;
    } catch {
      /* try the backup, then give up */
    }
  }
  return {};
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
export function saveSaveFile(file, entries) {
  const doc = { schema: SCHEMA };
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
    if (existsSync(file)) copyFileSync(file, file + '.bak');
    renameSync(tmp, file);
    return true;
  } catch {
    /* disk full, permissions, a watcher holding a handle — keep playing */
    return false;
  }
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
  const data = {
    run: loadSaveFile(pathFor('run')),
    profile: loadSaveFile(pathFor('profile')),
  };
  /** @type {Record<string, ReturnType<typeof setTimeout> | undefined>} */
  const timers = {};
  const healthy = { run: true, profile: true };

  function writeNow(name) {
    clearTimeout(timers[name]);
    timers[name] = undefined;
    const before = healthy.run && healthy.profile;
    healthy[name] = saveSaveFile(pathFor(name), data[name]);
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
