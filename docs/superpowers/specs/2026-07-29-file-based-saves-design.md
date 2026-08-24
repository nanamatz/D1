# File-Based Saves — Design (2026-07-29)

> **Cross-platform amendment (2026-08-24):** The same JSON format now ships on
> Windows x64 and macOS Universal. Electron's fixed `Play the World` userData
> name resolves to `%APPDATA%/Play the World/saves/` on Windows and
> `~/Library/Application Support/Play the World/saves/` on macOS. Steam
> Auto-Cloud maps these as one logical cross-OS save set; see
> `docs/STEAM_RELEASE.md`.

Move player progress out of `localStorage` and into plain JSON files on disk, so
Steam Cloud has something it can sync.

Cell 2 of the five-cell Steam release described in
`docs/superpowers/specs/2026-07-29-desktop-packaging-design.md`. Cell 1 (desktop
shell) is shipped.

## Scope

**In scope:** a storage adapter every persistence site routes through; an
Electron preload bridge and main-process save store; two JSON save files with
atomic writes and one generation of backup; a one-time import of existing
`localStorage` data.

**Out of scope:** Steamworks APIs and Steam Cloud configuration (cell 3); save
export/import UI; cross-device conflict resolution;
multi-generation backups or a restore screen; changes to `src/engine/`.

## Why files at all

Steam Cloud syncs files. Electron's `localStorage` is Chromium LevelDB under
`%APPDATA%/Play the World/Local Storage/leveldb/` — binary, spread over several
files, written lazily, and coupled to the Chromium version. Pointing Steam Cloud
at it would sync half-written binary state and break on Electron upgrades.

## What counts as save data

Nine keys are save data and move to files on desktop:

`wj.run`, `wj.collection`, `wj.collectionSeen`, `wj.lifetime`, `wj.unlocks`,
`wj.vouchers`, `wj.emojiUnlocks`, `wj.tutorial`, `wj.tutorialIntro`

Three keys are machine-local preferences and stay in `localStorage` everywhere:

`wj.settings`, `wj.lang`, `wj.sortMode`

Resolution, volume, and language following a player to another PC is usually an
annoyance, not a feature.

## Two constraints that shape everything

1. **Every read is synchronous.** `readTips()`, `mascotSrc()`, `loadCollection()`
   and others read storage during render. An async storage API would ripple
   through all 25 call sites and the render logic around them.
2. **The renderer cannot touch the filesystem.** Cell 1 set
   `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and
   deliberately shipped no preload. Files require opening a bridge.

The design resolves both: load the whole save once at boot into memory, serve
synchronous reads from there, and flush writes asynchronously.

## Approach

Rejected alternatives:

- **Keep `localStorage`, mirror it from the main process** (read the file into
  `localStorage` at boot, export on quit). Touches no UI code, but a crash loses
  everything since the last quit, and the file is a copy rather than the source
  of truth — so a Steam Cloud restore mid-session gets overwritten. Fundamentally
  incompatible with Cloud.
- **`sandbox: false` with real `fs` in the preload.** Shortest code, but it
  reverses cell 1's security posture and puts a synchronous file write on the
  render thread on every action.

## Storage adapter

New file `src/ui/storage.ts` owns every persistence path:

```ts
readValue<T>(key: string): T | null       // parse included
writeValue(key: string, value: unknown): void
writeRaw(key: string, json: string): void // persist.ts already holds the string
remove(key: string): void
```

All 25 `localStorage.*` call sites across nine files route through it. Today each
site hand-rolls `JSON.parse(localStorage.getItem(K))` and
`setItem(K, JSON.stringify(v))` inside its own `try/catch`, so a value-based API
makes the call sites **shorter**. The one exception is `src/ui/persist.ts`, which
already holds a serialized string for its dedupe check and therefore keeps a raw
write path.

Routing is one explicit list inside the adapter:

```ts
const SAVE_KEYS = new Set([
  'wj.run', 'wj.collection', 'wj.collectionSeen', 'wj.lifetime',
  'wj.unlocks', 'wj.vouchers', 'wj.emojiUnlocks', 'wj.tutorial',
  'wj.tutorialIntro',
]);
```

A key in `SAVE_KEYS` goes to files on desktop; everything else goes to
`localStorage` everywhere. Keeping the policy in one auditable list forces a
decision when a new key is added.

**Three profile slots (changed 2026-07-31).** The public key list stays the same,
but `storage.ts` multiplexes each progress value through a small versioned
three-slot envelope. The active slot (`wj.profile`) is a machine-local preference.
An older flat value is read as P1 and remains flat until another slot needs the
same key, so existing browser and desktop saves require no one-off migration.

Backend selection is the presence of `window.wj`. **The web build sends both
groups to `localStorage`, so its behaviour is byte-for-byte what it is today** —
one code path, no branching by build target. The engine knows none of this;
`src/engine/` is untouched.

The snapshot carries only the keys the save files actually contain. A save key
absent from the snapshot reads as `null` — the same answer `localStorage` gives
for a key that was never written, so every existing caller's "no saved value"
branch already handles it.

## Bridge

`desktop/preload.cjs` exposes exactly three things:

```js
contextBridge.exposeInMainWorld('wj', {
  snapshot: ipcRenderer.sendSync('wj:load'),   // once, at preload time
  write: (key, json) => ipcRenderer.send('wj:write', key, json),
  remove: (key) => ipcRenderer.send('wj:remove', key),
});
```

`contextIsolation`, `nodeIntegration` and `sandbox` keep their cell 1 values. The
renderer still has no `fs` and no `require` — only read/write/remove over nine
keys.

**The `.cjs` extension is required, not a slip.** Cell 1 made the shell ESM
(`"type": "module"` with `.js` files), but **a sandboxed preload must be
CommonJS** — Electron does not support an ESM preload when `sandbox: true`. Under
`"type": "module"`, `.cjs` is CommonJS. The rest of the shell stays ESM.

`sendSync` blocks the main process, but only once, before page load.
Every subsequent write is fire-and-forget.

Main-process logic lives in `desktop/save-store.js` (ESM). `main.js` keeps its
platform-neutral cell 1 responsibility and merely registers the handlers.

**Main does not trust keys from the renderer.** It validates against the same
`SAVE_KEYS` list and silently drops anything else. Keys never become filenames
(they are properties inside `run.json` / `profile.json`), so path traversal is
impossible by construction; the check is defence in depth.

## File layout

Windows: `%APPDATA%/Play the World/saves/`

macOS: `~/Library/Application Support/Play the World/saves/`

Both locations contain the same cross-platform JSON format:

```
run.json        run.json.bak
profile.json    profile.json.bak
```

A dedicated `saves/` directory rather than the userData root, which is full of
Chromium's own `Cache`, `Local Storage` and `GPUCache` directories. This folder
is what Steam Cloud will point at in cell 3 and what a player would back up.

Files hold **parsed, human-readable JSON**. The bridge carries JSON strings; the
main process parses on write and re-stringifies on read, so the file shows real
structure rather than one escaped string. Every value is valid JSON because
everything enters through `JSON.stringify` in the adapter; if a parse ever fails,
main drops that single write and logs it rather than corrupting the file.

```jsonc
// profile.json
{ "schema": 1, "wj.collection": {…}, "wj.lifetime": {…}, "wj.unlocks": […] }
```

`schema` versions the **file format**. `wj.run` keeps its own `version: 4`
envelope from `src/ui/persist.ts`, whose rule is that a mismatched run save is
discarded rather than migrated. **That rule is exactly why there are two files:**
sharing one would mean a run-schema bump destroys the collection and lifetime
stats.

## Durability

Write order:

1. write `X.tmp`, then fsync
2. if `X` exists, copy it to `X.bak`
3. rename `X.tmp` over `X`

A crash between 2 and 3 leaves `X` intact; a crash during 1 leaves `X` intact.
`X.bak` is therefore always a previously complete file.

Read order: parse `X`; on missing or corrupt, parse `X.bak`; if that fails too,
start empty. **No path throws.** This extends the rule `src/ui/persist.ts`
already states — a save is a convenience, never a reason to fail to boot.

Writes are debounced per file at 300ms. `wj.run` is written on nearly every
action (`src/ui/useGame.ts` persists on each state change whose resting snapshot
differs), so debouncing collapses bursts. Removals go through the same debounced
path — a `remove` is just a write that drops the key. On `before-quit` any
pending write is flushed synchronously; blocking at quit is harmless and
guarantees the last action survives.

**Named risk:** cell 1 hit `EPERM` on `rename` inside the repository because
workspace watchers held file handles. `%APPDATA%` is not watched, so this should
not recur — but it is the same operation, and the never-throw plus `.bak`
fallback design means even a failed rename leaves the game running on the
previous file instead of breaking.

## One-time migration

The desktop app already holds real data from cell 1's manual verification. Main
reports `fresh: true` alongside the snapshot when the `saves/` directory did not
exist at boot. **Only when `fresh`**, the adapter reads the nine save keys from
`localStorage`, writes them through the bridge, **and deletes the originals**.

Gating on `fresh` rather than on "the file has no value for this key" matters: the
weaker rule would re-import on every launch after any single key was cleared.

Deleting the originals matters for a case `fresh` alone does not cover (found
during execution, when the first migration left the `localStorage` copies in
place): deleting the `saves/` folder makes `fresh` true again, so a leftover copy
would resurrect the old profile — exactly what "delete my save and start over"
must not do. Only save keys are deleted; preferences are untouched.

## Testing

The persistence modules are already covered — six test files hand-roll a
`globalThis.localStorage` shim (`jsdom is not configured project-wide`). Because
the adapter falls back to `localStorage` when no bridge is present, **those shims
keep working untouched**, and those tests become the refactor's regression net.

Consolidating the six duplicated shims into one helper is deliberately **not**
done here: they work, and mixing unrelated churn into a 25-site refactor would
obscure the cause of any regression.

| Target | Method |
|---|---|
| `src/ui/storage.ts` | Unit: key routing (save keys → bridge, preference keys → `localStorage`), backend selection, parse-failure fallback, `fresh` migration running exactly once and deleting only the save-key originals |
| `desktop/save-store.js` | Unit in a temp directory: round-trip; corrupt primary falls back to `.bak`; both corrupt starts empty; `.bak` is always the previous complete file; unknown key rejected |
| IPC wiring and preload | **Not unit-tested** — same rationale as cell 1: fixture cost exceeds the value for this much static glue |
| Existing 582 tests | Staying green is the refactor's acceptance bar |

**Manual checklist** (needs a human, as in cell 1):

1. Play partway into a run, quit, and confirm `saves/run.json` is readable JSON.
2. Relaunch — the run resumes and the collection, unlocks and lifetime stats are intact.
3. Corrupt `run.json` by hand, relaunch — the game recovers from `run.json.bak`.
4. Delete both files and both backups, relaunch — a clean profile, no crash.
5. Confirm settings, language and hand-sort order did **not** move into `saves/`.
6. Delete the whole `saves/` folder, relaunch — still a clean profile, because
   the migration deleted the `localStorage` originals and cannot re-run.
