# File-Based Saves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the eight player-progress keys out of `localStorage` into plain JSON files on disk, so Steam Cloud has something it can sync.

**Architecture:** One synchronous storage adapter (`src/ui/storage.ts`) becomes the single persistence path for the UI. It picks a backend at runtime: `localStorage` on the web, and on desktop an in-memory cache seeded once at boot through a sandboxed preload bridge, with writes forwarded to the main process. The main process owns the files — atomic writes with one backup generation. The engine is untouched.

**Tech Stack:** TypeScript (strict), Electron 43, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-07-29-file-based-saves-design.md`

## Global Constraints

- **`desktop/` must not import anything from `src/`.** Dependency direction is one-way (`desktop/ → dist/`), set by cell 1. The save-key list is therefore duplicated in `desktop/save-store.js`; Task 3 adds a test that fails if the two copies drift.
- **`desktop/preload.cjs` must be `.cjs`.** The repo is `"type": "module"`, but a sandboxed preload must be CommonJS — Electron does not support an ESM preload when `sandbox: true`. Every other shell file stays ESM `.js`.
- **Do not change `contextIsolation: true`, `nodeIntegration: false`, or `sandbox: true`** in `desktop/main.js`.
- **Do not modify anything under `src/engine/`.**
- **Reads must stay synchronous.** `readTips()`, `mascotSrc()` and `loadCollection()` are called during render; an async storage API is not acceptable.
- **Nothing in the persistence path may throw.** A save is a convenience, never a reason to fail to boot — the rule `src/ui/persist.ts` already states.
- **These eight keys are save data:** `wj.run`, `wj.collection`, `wj.collectionSeen`, `wj.lifetime`, `wj.unlocks`, `wj.vouchers`, `wj.tutorial`, `wj.tutorialIntro`.
- **These three stay machine-local in `localStorage` everywhere:** `wj.settings`, `wj.lang`, `wj.sortMode`.
- **The web build's behaviour must not change.** With no bridge present every key goes to `localStorage`, exactly as today.
- **Do not touch the six test files that shim `globalThis.localStorage`** (`chromatic-unlocks`, `mascot-skins`, `p2-collection`, `playtest06-persist`, `tutorial-store`, `voucher-progress`). They keep working through the adapter's `localStorage` fallback and are this refactor's regression net. Consolidating their duplicated shims is explicitly out of scope.
- **Save files live in `%APPDATA%/Play the World/saves/`** — never the userData root.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/ui/storage.ts` | **New.** The only persistence path: sync read/write API, `SAVE_KEYS` routing, backend selection, one-time migration. |
| `tests/storage-adapter.test.ts` | **New.** Adapter unit tests against a fake bridge and fake `localStorage`. |
| `desktop/save-store.js` | **New.** File load with `.bak` fallback, atomic write with backup, the debouncing store. |
| `tests/desktop-save-store.test.mjs` | **New.** File-store unit tests in a temp directory, plus the key-list drift guard. |
| `desktop/preload.cjs` | **New.** Exposes exactly `snapshot` / `fresh` / `write` / `remove`. |
| `desktop/main.js` | Modify: register the preload, create the store, wire IPC, flush on quit. |
| `src/ui/persist.ts` | Modify: route through the adapter (keeps a raw-string write for its dedupe). |
| `src/ui/collection.ts` | Modify: route through the adapter. |
| `src/ui/lifetime.ts` | Modify: route through the adapter. |
| `src/ui/unlocks.ts` | Modify: route through the adapter. |
| `src/ui/voucherProgress.ts` | Modify: route through the adapter. |
| `src/ui/tutorial.ts` | Modify: route through the adapter. |
| `src/ui/hooks.ts` | Modify: `usePersistedState` routes through the adapter. |
| `src/ui/settings.ts` | Modify: `readTips` routes through the adapter. |
| `src/ui/mascots.ts` | Modify: `readSelection` routes through the adapter. |
| `AGENTS.md` + `CLAUDE.md` | Modify: the rule that keeps saves working. |

---

### Task 1: Storage adapter

Built first and fully test-driven, because everything else depends on its shape. Both backends are pure logic given a bridge object, so the desktop path is completely unit-testable here with a fake — no Electron needed.

**Files:**
- Create: `src/ui/storage.ts`
- Test: `tests/storage-adapter.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SAVE_KEYS: ReadonlySet<string>`
  - `readValue<T>(key: string): T | null`
  - `writeValue(key: string, value: unknown): void`
  - `writeRaw(key: string, json: string): void`
  - `remove(key: string): void`
  - `resetStorageCache(): void` — test-only
  - `interface StorageBridge { snapshot: Record<string, string>; fresh: boolean; write(key: string, json: string): void; remove(key: string): void }` — the shape `desktop/preload.cjs` must expose on `window.wj` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `tests/storage-adapter.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SAVE_KEYS,
  readValue,
  remove,
  resetStorageCache,
  writeRaw,
  writeValue,
  type StorageBridge,
} from '../src/ui/storage';

// jsdom is not configured project-wide; provide a minimal localStorage shim,
// matching what the existing persistence tests do.
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

function fakeBridge(snapshot: Record<string, string> = {}, fresh = false) {
  const writes: [string, string][] = [];
  const removes: string[] = [];
  const bridge: StorageBridge = {
    snapshot,
    fresh,
    write: (k, j) => { writes.push([k, j]); },
    remove: (k) => { removes.push(k); },
  };
  return { bridge, writes, removes };
}

function installBridge(b: StorageBridge | null) {
  if (b) (globalThis as { wj?: StorageBridge }).wj = b;
  else delete (globalThis as { wj?: StorageBridge }).wj;
  resetStorageCache();
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemStorage() as unknown as Storage;
  installBridge(null);
});

describe('web backend (no bridge)', () => {
  it('sends a save key to localStorage', () => {
    writeValue('wj.lifetime', { runs: 3 });
    expect(localStorage.getItem('wj.lifetime')).toBe('{"runs":3}');
    expect(readValue<{ runs: number }>('wj.lifetime')).toEqual({ runs: 3 });
  });

  it('sends a preference key to localStorage', () => {
    writeValue('wj.lang', 'ko');
    expect(readValue<string>('wj.lang')).toBe('ko');
  });
});

describe('desktop backend (bridge present)', () => {
  it('sends a save key to the bridge, not localStorage', () => {
    const { bridge, writes } = fakeBridge();
    installBridge(bridge);
    writeValue('wj.lifetime', { runs: 3 });
    expect(writes).toEqual([['wj.lifetime', '{"runs":3}']]);
    expect(localStorage.getItem('wj.lifetime')).toBeNull();
  });

  it('keeps preference keys in localStorage even with a bridge', () => {
    const { bridge, writes } = fakeBridge();
    installBridge(bridge);
    writeValue('wj.settings', { tips: false });
    expect(writes).toEqual([]);
    expect(localStorage.getItem('wj.settings')).toBe('{"tips":false}');
  });

  it('reads a save key back without a reload (write-through cache)', () => {
    const { bridge } = fakeBridge();
    installBridge(bridge);
    writeValue('wj.unlocks', ['red']);
    expect(readValue<string[]>('wj.unlocks')).toEqual(['red']);
  });

  it('seeds reads from the boot snapshot', () => {
    const { bridge } = fakeBridge({ 'wj.collection': '{"cat":1}' });
    installBridge(bridge);
    expect(readValue<Record<string, number>>('wj.collection')).toEqual({ cat: 1 });
  });

  it('returns null for a save key absent from the snapshot', () => {
    const { bridge } = fakeBridge();
    installBridge(bridge);
    expect(readValue('wj.vouchers')).toBeNull();
  });

  it('remove drops from the cache and tells the bridge', () => {
    const { bridge, removes } = fakeBridge({ 'wj.tutorial': '{"a":1}' });
    installBridge(bridge);
    remove('wj.tutorial');
    expect(readValue('wj.tutorial')).toBeNull();
    expect(removes).toEqual(['wj.tutorial']);
  });
});

describe('parsing', () => {
  it('returns null for a missing key', () => {
    expect(readValue('wj.lifetime')).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem('wj.lifetime', '{not json');
    expect(readValue('wj.lifetime')).toBeNull();
  });

  it('writeValue(undefined) is a no-op, not a literal "undefined"', () => {
    writeValue('wj.lifetime', undefined);
    expect(localStorage.getItem('wj.lifetime')).toBeNull();
  });

  it('writeRaw stores the string as given', () => {
    writeRaw('wj.run', '{"version":4}');
    expect(readValue<{ version: number }>('wj.run')).toEqual({ version: 4 });
  });
});

describe('one-time migration', () => {
  it('imports localStorage save keys when the bridge reports fresh', () => {
    localStorage.setItem('wj.collection', '{"cat":1}');
    localStorage.setItem('wj.lang', '"ko"');
    const { bridge, writes } = fakeBridge({}, true);
    installBridge(bridge);

    expect(readValue<Record<string, number>>('wj.collection')).toEqual({ cat: 1 });
    // Preference keys are NOT save data and must not be imported.
    expect(writes).toEqual([['wj.collection', '{"cat":1}']]);
  });

  it('does not import when the bridge is not fresh', () => {
    localStorage.setItem('wj.collection', '{"cat":1}');
    const { bridge, writes } = fakeBridge({}, false);
    installBridge(bridge);

    expect(readValue('wj.collection')).toBeNull();
    expect(writes).toEqual([]);
  });

  it('never overwrites a key the snapshot already has', () => {
    localStorage.setItem('wj.collection', '{"stale":1}');
    const { bridge, writes } = fakeBridge({ 'wj.collection': '{"fresh":2}' }, true);
    installBridge(bridge);

    expect(readValue<Record<string, number>>('wj.collection')).toEqual({ fresh: 2 });
    expect(writes).toEqual([]);
  });

  it('runs at most once even across many reads', () => {
    localStorage.setItem('wj.collection', '{"cat":1}');
    const { bridge, writes } = fakeBridge({}, true);
    installBridge(bridge);

    readValue('wj.collection');
    readValue('wj.lifetime');
    readValue('wj.collection');
    expect(writes).toHaveLength(1);
  });
});

describe('SAVE_KEYS', () => {
  it('is exactly the eight progress keys', () => {
    expect([...SAVE_KEYS].sort()).toEqual([
      'wj.collection',
      'wj.collectionSeen',
      'wj.lifetime',
      'wj.run',
      'wj.tutorial',
      'wj.tutorialIntro',
      'wj.unlocks',
      'wj.vouchers',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/storage-adapter.test.ts`
Expected: FAIL — cannot resolve `../src/ui/storage`.

- [ ] **Step 3: Write the implementation**

Create `src/ui/storage.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/storage-adapter.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/storage.ts tests/storage-adapter.test.ts
git commit -m "feat(ui): storage adapter with localStorage and bridge backends"
```

---

### Task 2: Route every persistence site through the adapter

A mechanical refactor of nine files. The acceptance bar is that the existing suite stays green — six test files already shim `globalThis.localStorage` and exercise these modules, and they keep working because no bridge is present in tests.

**Files:**
- Modify: `src/ui/persist.ts`, `src/ui/collection.ts`, `src/ui/lifetime.ts`, `src/ui/unlocks.ts`, `src/ui/voucherProgress.ts`, `src/ui/tutorial.ts`, `src/ui/hooks.ts`, `src/ui/settings.ts`, `src/ui/mascots.ts`

**Interfaces:**
- Consumes: `readValue`, `writeValue`, `writeRaw`, `remove` from Task 1.
- Produces: no API changes. Every exported function in these files keeps its current name, parameters and return type — this task changes only how they reach storage.

- [ ] **Step 1: Record the baseline**

Run: `npm test`
Expected: PASS. **Write down the file and test counts** — Step 12 must match them exactly. (Task 1 added a test file, so this is not the 71/582 the repo had before this plan started.)

- [ ] **Step 2: Migrate `src/ui/persist.ts`**

Replace the three storage functions (leave `serializeRun`, `atRest`, `VERSION` and the `Envelope` interface exactly as they are):

```ts
import { readValue, remove, writeRaw } from './storage';

export function writeRun(json: string): void {
  writeRaw(KEY, json);
}

/** The saved run, or null if there is none, it's unreadable, or the schema moved. */
export function loadRun(): GameState | null {
  const env = readValue<Partial<Envelope>>(KEY);
  if (!env || env.version !== VERSION || !env.state) return null;
  const s = env.state;
  // Cheap shape check: a corrupt or half-written save must never boot the game
  // into a broken state — fall back to a fresh bootstrap instead.
  if (
    typeof s.seed !== 'string' ||
    typeof s.phase !== 'string' ||
    !s.run ||
    !s.blind ||
    !Array.isArray(s.blind.hand) ||
    !Array.isArray(s.run.jokers)
  ) {
    return null;
  }
  return s;
}

export function clearRun(): void {
  remove(KEY);
}
```

- [ ] **Step 3: Migrate `src/ui/collection.ts`**

```ts
import { readValue, writeValue } from './storage';

export function loadCollection(): Collection {
  return readValue<Collection>(KEY) ?? {};
}

export function recordWord(word: string, now: number = Date.now()): boolean {
  const w = word.trim().toLowerCase();
  if (!w) return false;
  const collection = loadCollection();
  if (collection[w] !== undefined) return false;
  collection[w] = now;
  writeValue(KEY, collection);
  return true;
}

export function collectionSize(): number {
  return Object.keys(loadCollection()).length;
}

const SEEN_KEY = 'wj.collectionSeen';

/** Words collected since the collection was last viewed — drives the `!` badge (spec §0). */
export function unseenCount(): number {
  const seen = readValue<number>(SEEN_KEY) ?? 0;
  return Math.max(0, collectionSize() - (Number.isFinite(seen) ? seen : 0));
}

/** Mark the collection as viewed (clears the badge). */
export function markCollectionSeen(): void {
  writeValue(SEEN_KEY, collectionSize());
}
```

Note: `wj.collectionSeen` previously stored `String(n)` and read it with `Number(...)`. A bare number is valid JSON, so the stored bytes are identical and old values still read correctly.

- [ ] **Step 4: Migrate `src/ui/lifetime.ts`**

```ts
import { readValue, writeValue } from './storage';

export function loadLifetime(): Lifetime {
  const stored = readValue<Partial<Lifetime>>(KEY);
  return stored ? { ...EMPTY, ...stored } : { ...EMPTY };
}
```

and in `recordRunEnd`, replace the trailing `try { localStorage.setItem(...) } catch {}` block with:

```ts
  writeValue(KEY, next);
```

- [ ] **Step 5: Migrate `src/ui/unlocks.ts`**

```ts
import { readValue, remove as removeKey, writeValue } from './storage';

/** The set of ids the player has actually PLAYED (celebrated + recorded). */
export function loadPlayed(): Set<string> {
  return new Set(readValue<string[]>(KEY) ?? []);
}

function savePlayed(set: Set<string>): void {
  writeValue(KEY, [...set]);
}

export function resetUnlocks(): void {
  removeKey(KEY);
}
```

`isPlayed`, `markPlayed` and `playedCount` are unchanged — they call `loadPlayed`/`savePlayed`. The import is aliased to `removeKey` because this module already exports nothing named `remove`, but the alias keeps the call site unambiguous next to `resetUnlocks`.

- [ ] **Step 6: Migrate `src/ui/voucherProgress.ts`**

```ts
import { readValue, writeValue } from './storage';

export function loadVoucherProgress(): VoucherProgress {
  const stored = readValue<Partial<VoucherProgress>>(KEY);
  return stored ? { ...EMPTY, ...stored } : { ...EMPTY };
}

function store(p: VoucherProgress): void {
  writeValue(KEY, p);
}
```

- [ ] **Step 7: Migrate `src/ui/tutorial.ts`**

```ts
import { readValue, remove as removeKey, writeValue } from './storage';

export function loadTutorial(): Flags {
  return readValue<Flags>(KEY) ?? {};
}

export function markSeen(id: EncounterId, now: number = Date.now()): void {
  const flags = loadTutorial();
  if (flags[id] !== undefined) return;
  flags[id] = now;
  writeValue(KEY, flags);
}

export function resetTutorial(): void {
  removeKey(KEY);
}

export function hasSeenIntro(): boolean {
  return readValue<number>(INTRO_KEY) !== null;
}

export function markIntroSeen(): void {
  writeValue(INTRO_KEY, Date.now());
}

export function resetIntro(): void {
  removeKey(INTRO_KEY);
}
```

`hasSeen` and `seenCount` are unchanged. Note `wj.tutorialIntro` previously stored `String(Date.now())` and tested `!== null`; a bare number is valid JSON, so old values still read as a number and the check is equivalent.

- [ ] **Step 8: Migrate `src/ui/hooks.ts`**

Replace the body of `usePersistedState`:

```ts
import { readValue, writeValue } from './storage';

export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readValue<T>(key) ?? initial);
  useEffect(() => {
    writeValue(key, value);
  }, [key, value]);
  return [value, setValue];
}
```

This covers `wj.settings`, `wj.lang` and `wj.sortMode`, which are preference keys and therefore still land in `localStorage`.

- [ ] **Step 9: Migrate `src/ui/settings.ts`**

```ts
import { readValue } from './storage';

export function readTips(): boolean {
  const parsed = readValue<Partial<Settings>>(SETTINGS_KEY);
  return parsed?.tips ?? DEFAULT_SETTINGS.tips;
}
```

Keep the existing doc comment above it — it explains why this reads storage directly instead of using `useSettings()`.

- [ ] **Step 10: Migrate `src/ui/mascots.ts`**

```ts
import { readValue } from './storage';

function readSelection(): { mascot: WooDakSkin; unlockAll: boolean } {
  const p = readValue<{ mascot?: WooDakSkin; unlockAll?: boolean }>(SETTINGS_KEY) ?? {};
  return { mascot: p.mascot ?? 'woodak', unlockAll: !!p.unlockAll };
}
```

- [ ] **Step 11: Verify no direct localStorage use remains in the UI**

```bash
grep -rn "localStorage\." src --include=*.ts --include=*.tsx
```

Expected: matches **only** in `src/ui/storage.ts`. Any other file still touching it directly was missed.

- [ ] **Step 12: Run the full suite**

Run: `npm test`
Expected: PASS with **exactly the counts recorded in Step 1**. A drop in the test count means a file failed to import; a failure means a behaviour change. Either way, stop and fix before committing.

- [ ] **Step 13: Commit**

```bash
git add src/ui/persist.ts src/ui/collection.ts src/ui/lifetime.ts src/ui/unlocks.ts src/ui/voucherProgress.ts src/ui/tutorial.ts src/ui/hooks.ts src/ui/settings.ts src/ui/mascots.ts
git commit -m "refactor(ui): route all persistence through the storage adapter"
```

---

### Task 3: Save file store

The main-process side. Pure file logic, tested in a temp directory — no Electron. IPC comes in Task 4.

**Files:**
- Create: `desktop/save-store.js`
- Test: `tests/desktop-save-store.test.mjs`

**Interfaces:**
- Consumes: nothing at runtime. The test imports `SAVE_KEYS` from `src/ui/storage.ts` purely to guard against drift — the module itself imports nothing from `src/`. (A `.mjs` test importing a `.ts` module is resolved by Vitest's Vite pipeline; if that import fails to resolve, rename the test to `tests/desktop-save-store.test.ts` rather than dropping the guard.)
- Produces:
  - `SAVE_KEYS: Set<string>` — a duplicate of the adapter's list
  - `loadSaveFile(path: string): Record<string, string>` — key → JSON string; `{}` when missing or corrupt
  - `saveSaveFile(path: string, entries: Record<string, string>): void` — atomic, with one backup generation
  - `createSaveStore(dir: string): { fresh: boolean, snapshot(): Record<string,string>, set(key: string, json: string): void, remove(key: string): void, flush(): void }`

- [ ] **Step 1: Write the failing test**

Create `tests/desktop-save-store.test.mjs`:

```js
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SAVE_KEYS,
  createSaveStore,
  loadSaveFile,
  saveSaveFile,
} from '../desktop/save-store.js';
import { SAVE_KEYS as ADAPTER_SAVE_KEYS } from '../src/ui/storage';

const dir = () => mkdtempSync(path.join(tmpdir(), 'wj-saves-'));

describe('loadSaveFile / saveSaveFile', () => {
  it('round-trips entries', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":3}' });
    expect(loadSaveFile(file)).toEqual({ 'wj.lifetime': '{"runs":3}' });
  });

  it('writes human-readable JSON, not an escaped string blob', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":3}' });
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('"schema": 1');
    expect(text).toContain('"runs": 3');
    expect(text).not.toContain('\\"');
  });

  it('returns {} for a missing file', () => {
    expect(loadSaveFile(path.join(dir(), 'nope.json'))).toEqual({});
  });

  it('falls back to .bak when the primary is corrupt', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}' });
    saveSaveFile(file, { 'wj.lifetime': '{"runs":2}' });
    writeFileSync(file, '{corrupt', 'utf8');
    // .bak holds the previous complete write
    expect(loadSaveFile(file)).toEqual({ 'wj.lifetime': '{"runs":1}' });
  });

  it('returns {} when both the primary and the backup are corrupt', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}' });
    saveSaveFile(file, { 'wj.lifetime': '{"runs":2}' });
    writeFileSync(file, '{corrupt', 'utf8');
    writeFileSync(file + '.bak', 'also corrupt', 'utf8');
    expect(loadSaveFile(file)).toEqual({});
  });

  it('keeps .bak as the previous complete file', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}' });
    expect(existsSync(file + '.bak')).toBe(false); // nothing to back up on the first write
    saveSaveFile(file, { 'wj.lifetime': '{"runs":2}' });
    expect(loadSaveFile(file + '.bak')).toEqual({ 'wj.lifetime': '{"runs":1}' });
  });

  it('drops an unparseable entry but still writes a valid file', () => {
    const file = path.join(dir(), 'profile.json');
    saveSaveFile(file, { 'wj.lifetime': '{"runs":1}', 'wj.unlocks': '{broken' });
    expect(loadSaveFile(file)).toEqual({ 'wj.lifetime': '{"runs":1}' });
  });
});

describe('createSaveStore', () => {
  it('reports fresh when the directory does not exist yet', () => {
    const d = path.join(dir(), 'saves');
    expect(createSaveStore(d).fresh).toBe(true);
  });

  it('reports not fresh once the directory exists', () => {
    const d = path.join(dir(), 'saves');
    const first = createSaveStore(d);
    first.set('wj.lifetime', '{"runs":1}');
    first.flush();
    expect(createSaveStore(d).fresh).toBe(false);
  });

  it('splits the run from the profile so a run reset cannot lose the profile', () => {
    const d = path.join(dir(), 'saves');
    const store = createSaveStore(d);
    store.set('wj.run', '{"version":4}');
    store.set('wj.lifetime', '{"runs":7}');
    store.flush();

    expect(loadSaveFile(path.join(d, 'run.json'))).toEqual({ 'wj.run': '{"version":4}' });
    expect(loadSaveFile(path.join(d, 'profile.json'))).toEqual({ 'wj.lifetime': '{"runs":7}' });
  });

  it('exposes both files in one snapshot', () => {
    const d = path.join(dir(), 'saves');
    const first = createSaveStore(d);
    first.set('wj.run', '{"version":4}');
    first.set('wj.lifetime', '{"runs":7}');
    first.flush();

    expect(createSaveStore(d).snapshot()).toEqual({
      'wj.run': '{"version":4}',
      'wj.lifetime': '{"runs":7}',
    });
  });

  it('remove deletes the key from the file', () => {
    const d = path.join(dir(), 'saves');
    const store = createSaveStore(d);
    store.set('wj.run', '{"version":4}');
    store.flush();
    store.remove('wj.run');
    store.flush();
    expect(loadSaveFile(path.join(d, 'run.json'))).toEqual({});
  });

  it('ignores a key that is not save data', () => {
    const d = path.join(dir(), 'saves');
    const store = createSaveStore(d);
    store.set('wj.settings', '{"tips":false}');
    store.set('../../evil', '"x"');
    store.flush();
    expect(createSaveStore(d).snapshot()).toEqual({});
  });
});

describe('key list drift', () => {
  it('matches the adapter list in src/ui/storage.ts', () => {
    expect([...SAVE_KEYS].sort()).toEqual([...ADAPTER_SAVE_KEYS].sort());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/desktop-save-store.test.mjs`
Expected: FAIL — cannot resolve `../desktop/save-store.js`.

- [ ] **Step 3: Write the implementation**

Create `desktop/save-store.js`:

```js
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
  } catch {
    /* disk full, permissions, a watcher holding a handle — keep playing */
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
export function createSaveStore(dir) {
  // Captured before any write creates the directory — gates the one-time import.
  const fresh = !existsSync(dir);

  const pathFor = (name) => path.join(dir, name + '.json');
  const data = {
    run: loadSaveFile(pathFor('run')),
    profile: loadSaveFile(pathFor('profile')),
  };
  /** @type {Record<string, ReturnType<typeof setTimeout> | undefined>} */
  const timers = {};

  function writeNow(name) {
    clearTimeout(timers[name]);
    timers[name] = undefined;
    saveSaveFile(pathFor(name), data[name]);
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/desktop-save-store.test.mjs`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add desktop/save-store.js tests/desktop-save-store.test.mjs
git commit -m "feat(desktop): save file store with atomic writes and one backup"
```

---

### Task 4: Bridge and IPC wiring

**Files:**
- Create: `desktop/preload.cjs`
- Modify: `desktop/main.js`

**Interfaces:**
- Consumes: `createSaveStore` from Task 3; the `StorageBridge` shape from Task 1 (`{ snapshot, fresh, write, remove }`).
- Produces: `window.wj` in the renderer, which activates the adapter's desktop backend.

- [ ] **Step 1: Write the preload**

Create `desktop/preload.cjs`:

```js
/**
 * Storage bridge. The ONLY thing the renderer gets beyond the DOM.
 *
 * Must be .cjs: the repo is "type": "module", but a sandboxed preload has to be
 * CommonJS — Electron does not support an ESM preload when sandbox: true.
 *
 * The snapshot is fetched synchronously because reads in the UI are synchronous
 * (readTips, mascotSrc and loadCollection run during render). One blocking call
 * before page load is not perceptible; every write afterwards is fire-and-forget.
 */
const { contextBridge, ipcRenderer } = require('electron');

const loaded = ipcRenderer.sendSync('wj:load');

contextBridge.exposeInMainWorld('wj', {
  snapshot: loaded.snapshot,
  fresh: loaded.fresh,
  write: (key, json) => ipcRenderer.send('wj:write', key, json),
  remove: (key) => ipcRenderer.send('wj:remove', key),
});
```

- [ ] **Step 2: Wire the main process**

In `desktop/main.js`, add to the imports:

```js
import { app, BrowserWindow, Menu, globalShortcut, ipcMain, screen } from 'electron';
import { createSaveStore } from './save-store.js';
```

Add the preload to `webPreferences` in `createWindow` (the other three options stay exactly as they are):

```js
    webPreferences: {
      preload: path.join(DIR, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
```

Replace the `app.whenReady()` block so the store exists **before** the window — the preload's synchronous `wj:load` has to be answerable the moment the window is created:

```js
app.whenReady().then(() => {
  // Player progress lives in <userData>/saves/, NOT the userData root, which is
  // full of Chromium's own Cache/Local Storage/GPUCache directories. This folder
  // is what Steam Cloud will point at.
  const saves = createSaveStore(path.join(app.getPath('userData'), 'saves'));

  // Registered before createWindow: the preload calls wj:load synchronously.
  ipcMain.on('wj:load', (event) => {
    event.returnValue = { snapshot: saves.snapshot(), fresh: saves.fresh };
  });
  ipcMain.on('wj:write', (_event, key, json) => saves.set(key, json));
  ipcMain.on('wj:remove', (_event, key) => saves.remove(key));

  // Writes are debounced; make sure the last action reaches disk.
  app.on('before-quit', () => saves.flush());

  const win = createWindow();

  globalShortcut.register('F11', () => {
    win.setFullScreen(!win.isFullScreen());
  });

  if (!app.isPackaged) {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      win.webContents.toggleDevTools();
    });
  }
});
```

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS, 73 files (the two new test files), all green. No test touches the shell wiring, so this is a regression check.

- [ ] **Step 4: Launch and confirm the bridge is live**

**Clear `ELECTRON_RUN_AS_NODE` first** — if it is set, Electron runs as plain Node and exits immediately with code 0 and no window, which looks exactly like a crash. In Bash: `unset ELECTRON_RUN_AS_NODE`.

```bash
npm run build && npm run desktop:run
```

Open DevTools with `Ctrl+Shift+I` (unpackaged, so it is enabled) and in the console:

```js
Object.keys(window.wj)   // ["snapshot", "fresh", "write", "remove"]
window.wj.fresh          // true on the very first run
typeof require           // "undefined" — the sandbox is still intact
```

If `window.wj` is undefined, the preload did not load — check the main-process console for a path or module-format error.

- [ ] **Step 5: Confirm the files appear**

Play far enough to start a run and collect a word, then quit the window normally (the X button — `before-quit` does not fire on a force-kill).

```bash
ls "$APPDATA/Play the World/saves/"
cat "$APPDATA/Play the World/saves/profile.json"
```

Expected: `run.json` and `profile.json` exist, and `profile.json` is readable JSON with `"schema": 1` and real structure — not one escaped string.

- [ ] **Step 6: Confirm the one-time migration ran**

Because cell 1's manual verification left real data in the desktop `localStorage`, the first launch above should have imported it. In DevTools:

```js
window.wj.fresh   // false on the SECOND launch onwards
```

and `profile.json` should already contain the collection and unlocks from that earlier play session, not an empty object.

- [ ] **Step 7: Commit**

```bash
git add desktop/preload.cjs desktop/main.js
git commit -m "feat(desktop): storage bridge wiring saves to the file store"
```

---

### Task 5: Manual verification and the documentation rule

**Files:**
- Modify: `AGENTS.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing — this is the final task.

**Why both files:** `CLAUDE.md` is in `.gitignore` and absent from the shared repository; `AGENTS.md` is the tracked mirror. A rule in only one of them drifts.

- [ ] **Step 1: Run the manual checklist**

Against the packaged build (`npm run build:desktop`, then run `../D1-release/win-unpacked/Play the World.exe` from Explorer). Every item must pass:

1. Play partway into a run, quit with the X button, and confirm `saves/run.json` is readable JSON.
2. Relaunch — the run resumes, and the collection, unlocks and lifetime stats are intact.
3. Corrupt `run.json` by hand (replace its contents with `{oops`), relaunch — the game recovers from `run.json.bak` rather than losing the run.
4. Delete `run.json`, `run.json.bak`, `profile.json` and `profile.json.bak`, relaunch — a clean profile, no crash, no error dialog.
5. Change the language and hand-sort order, quit, relaunch — they persist, and **`saves/` still contains no `wj.settings`, `wj.lang` or `wj.sortMode`**.

Fix any failure before continuing — do not document a rule for a build that does not pass.

- [ ] **Step 2: Add the rule to `AGENTS.md`**

Add this bullet to the "Key rules easy to get wrong" list, directly after the desktop-build bullet added in cell 1:

```markdown
- **Player progress goes through `src/ui/storage.ts` — never `localStorage` directly (file-based saves, 2026-07-29):** the UI has exactly one persistence path. `SAVE_KEYS` in that file lists the eight progress keys (`wj.run`, `wj.collection`, `wj.collectionSeen`, `wj.lifetime`, `wj.unlocks`, `wj.vouchers`, `wj.tutorial`, `wj.tutorialIntro`); on desktop they are written to `%APPDATA%/Play the World/saves/{run,profile}.json` by the main process, and Steam Cloud will sync that folder. Everything else (`wj.settings`, `wj.lang`, `wj.sortMode`) is a machine-local preference and stays in `localStorage` everywhere. **Adding a persisted key means deciding which side it belongs on** — and `desktop/save-store.js` keeps a duplicate of `SAVE_KEYS` because `desktop/` cannot import from `src/`, so update both (a test fails if they drift). `run.json` and `profile.json` are separate on purpose: `persist.ts` DISCARDS a run whose `VERSION` moved, and one shared file would take the collection and lifetime stats with it. Reads must stay synchronous — the desktop backend loads once at boot through the preload bridge and serves reads from memory. `desktop/preload.cjs` must stay `.cjs`: a sandboxed preload has to be CommonJS even though the rest of the shell is ESM.
```

- [ ] **Step 3: Mirror the rule into `CLAUDE.md`**

Add the identical bullet at the same position in `CLAUDE.md`.

- [ ] **Step 4: Verify the two files agree**

```bash
diff <(grep -A2 "Player progress goes through" AGENTS.md) <(grep -A2 "Player progress goes through" CLAUDE.md)
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: rule keeping player progress on the storage adapter"
```

`CLAUDE.md` is gitignored, so `git add` on it is a no-op — that is expected. The tracked copy is `AGENTS.md`, and the local `CLAUDE.md` edit still needs to happen for this session's tooling.

---

## Out of scope — the remaining Steam cells

3. Steamworks integration (achievements, Cloud configuration, overlay)
4. Build/submit pipeline (code signing, `steamcmd` upload, branches)
5. Asset optimization (`dist` is 71MB; pack and boss PNGs run 1.6–1.9MB each)

Also out of scope here: save export/import UI, multiple save slots, cross-device conflict resolution, multi-generation backups, and consolidating the six duplicated `localStorage` shims in the test suite.
