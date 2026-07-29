# Desktop Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing web build as an offline-capable Windows desktop application via Electron, producing a Steam-ready unpacked folder.

**Architecture:** A new `desktop/` directory at the repository root holds an Electron main process that opens one window and loads `dist/index.html` over `file://`. It imports no game code — the dependency direction is one-way (`desktop/ → dist/`). Two changes make the web build loadable offline: fonts move from the Google Fonts CDN to self-hosted npm packages, and Vite's `base` becomes relative. A build gate script scans the built output and fails the build if either regresses.

**Tech Stack:** Electron 43, electron-builder 26, `@fontsource/*` 5.3, Vite 8, Vitest 4, `pngjs` (already a devDependency).

**Spec:** `docs/superpowers/specs/2026-07-29-desktop-packaging-design.md`

## Global Constraints

- **Platform: Windows only.** Do not add macOS or Linux build targets.
- **App name is `Play the World`, fixed via `app.setName()`.** Electron stores localStorage under `%APPDATA%/<appName>/`; renaming later orphans every player's save. This string must never change. It is distinct from the window title "Play the Wor!d", which comes from `index.html`'s `<title>`.
- **`desktop/` must not import anything from `src/` or `data/`.** It reads only the built `dist/`.
- **No preload script.** The renderer needs zero Node APIs in this scope. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **No installer target.** Steam copies a depot folder and runs the exe. Only `--dir` output.
- **Do not modify any file under `src/engine/`.** The engine stays headless.
- **Do not modify `src/ui/styles/tokens.css` fit-scale rules.** Window sizing is the shell's job; the CSS already scales the board.
- **The existing `deploy` script must keep working.** Do not remove or rename it.
- **The repo is ESM** (`"type": "module"` in `package.json`). Shell files are `.js` and therefore ESM: use `fileURLToPath(import.meta.url)` for paths, never `__dirname`.
- **Do not add glyph subsetting** for Noto Sans KR. Ship full weights.
- **Do not optimize assets.** The 63MB `dist` is out of scope.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/check-offline.mjs` | Pure violation detector + CLI. Scans built output for external URLs and absolute asset paths. |
| `tests/desktop-offline-gate.test.mjs` | Tests for the detector's pure function. |
| `vite.config.ts` (modify) | `base` becomes `'./'`. |
| `src/main.tsx` (modify) | Adds `@fontsource` CSS imports. |
| `index.html` (modify) | Removes the Google Fonts `<link>` and `<preconnect>` tags. |
| `desktop/main.js` | Electron main process: window creation, load, keys, menu removal. |
| `desktop/window-state.js` | Pure bounds logic + persistence to `%APPDATA%`. |
| `tests/desktop-window-state.test.mjs` | Tests for the pure bounds functions. |
| `scripts/make-icon.mjs` | Generates `desktop/icon.ico` from a source PNG using `pngjs`. |
| `desktop/icon.ico` | Interim app icon (generated, committed). |
| `package.json` (modify) | `main` field, `build` config, three scripts, new devDependencies. |
| `.gitignore` (modify) | Ignores `release/`. |
| `AGENTS.md` + `CLAUDE.md` (modify) | The rule that keeps the desktop build working. |

**Why tests are `.mjs`:** `tsconfig.json` sets `include: ["src", "tests"]` with `allowJs` unset (false), so TypeScript ignores `.mjs` files entirely — they will not be type-checked or emitted into `dist/` by `tsc -b`. Vitest's default include pattern (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) does match them. This lets the shell's plain-JS modules be tested without adding `allowJs` to the whole project.

---

### Task 1: Offline violation detector

The gate that protects everything else. Built first and test-driven, because it is the only automated protection in this plan.

**Files:**
- Create: `scripts/check-offline.mjs`
- Test: `tests/desktop-offline-gate.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `findViolations(fileName: string, content: string) => Violation[]` where `Violation = { file: string, kind: 'external-url' | 'absolute-path', snippet: string }`. Task 6 invokes this file as a CLI.

**Critical detail — the SVG namespace allowlist.** `src/ui/assets/packs/*.svg` contain `xmlns="http://www.w3.org/2000/svg"`. That is an XML namespace identifier, not a network fetch, and it ends up inside the bundled output. Without an allowlist the gate produces a false positive on every build and becomes noise that gets disabled. Allowlist any URL beginning `http://www.w3.org/` or `https://www.w3.org/`.

- [ ] **Step 1: Write the failing test**

Create `tests/desktop-offline-gate.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import { findViolations } from '../scripts/check-offline.mjs';

describe('findViolations', () => {
  it('flags a Google Fonts stylesheet link', () => {
    const html = '<link href="https://fonts.googleapis.com/css2?family=Jost" rel="stylesheet" />';
    const found = findViolations('index.html', html);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('external-url');
    expect(found[0].snippet).toContain('fonts.googleapis.com');
  });

  it('flags an external URL hidden inside a JS bundle', () => {
    const js = 'const u="https://cdn.example.com/sprite.png";';
    expect(findViolations('assets/index-abc.js', js)).toHaveLength(1);
  });

  it('ignores the SVG XML namespace, which is not a network fetch', () => {
    const js = 'const s=\'<svg xmlns="http://www.w3.org/2000/svg" width="10"></svg>\';';
    expect(findViolations('assets/index-abc.js', js)).toEqual([]);
  });

  it('flags an absolute asset path in HTML', () => {
    const html = '<script type="module" src="/assets/index-abc.js"></script>';
    const found = findViolations('index.html', html);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('absolute-path');
  });

  it('flags an absolute url() in CSS', () => {
    const css = '@font-face{src:url(/files/jost-300.woff2) format("woff2");}';
    const found = findViolations('assets/index-abc.css', css);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('absolute-path');
  });

  it('passes clean relative output', () => {
    const html = '<script type="module" src="./assets/index-abc.js"></script>';
    const css = '@font-face{src:url(./files/jost-300.woff2) format("woff2");}';
    expect(findViolations('index.html', html)).toEqual([]);
    expect(findViolations('assets/index-abc.css', css)).toEqual([]);
  });

  it('does not apply the absolute-path rule to JS bundles', () => {
    // Game strings and regexes legitimately contain "/..." — only markup is checked.
    const js = 'const path="/usr/share";';
    expect(findViolations('assets/index-abc.js', js)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/desktop-offline-gate.test.mjs`
Expected: FAIL — cannot resolve `../scripts/check-offline.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/check-offline.mjs`:

```js
/**
 * Offline build gate.
 *
 * The desktop build loads dist/ over file:// with no network. Two kinds of
 * change break that while working perfectly in a browser, so they are invisible
 * during development:
 *   1. an external http(s) dependency (a CDN font, script or image)
 *   2. an asset path starting with "/" (only resolves when served from a root)
 *
 * Scans the whole build output — a CDN URL can hide inside a stylesheet or a
 * bundled component, not just index.html.
 *
 * Usage: node scripts/check-offline.mjs [distDir]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** XML namespace identifiers, not network fetches. They appear in bundled SVGs. */
const URL_ALLOWLIST = [/^https?:\/\/www\.w3\.org\//];

const URL_RE = /https?:\/\/[^\s"'`)\\]+/g;
/** Absolute src/href in markup. */
const ABS_ATTR_RE = /(?:src|href)\s*=\s*"\/[^"]*"/g;
/** Absolute url() in CSS. */
const ABS_URL_RE = /url\(\s*['"]?\/[^)'"]*/g;

const MARKUP_EXT = new Set(['.html', '.css']);

/**
 * @param {string} fileName path used for reporting; its extension selects rules
 * @param {string} content
 * @returns {{file: string, kind: 'external-url'|'absolute-path', snippet: string}[]}
 */
export function findViolations(fileName, content) {
  const out = [];

  for (const match of content.matchAll(URL_RE)) {
    const url = match[0];
    if (URL_ALLOWLIST.some((re) => re.test(url))) continue;
    out.push({ file: fileName, kind: 'external-url', snippet: url });
  }

  // Absolute-path rules apply to markup only. JS bundles legitimately contain
  // strings beginning with "/" that are not asset references.
  if (MARKUP_EXT.has(path.extname(fileName))) {
    for (const re of [ABS_ATTR_RE, ABS_URL_RE]) {
      for (const match of content.matchAll(re)) {
        out.push({ file: fileName, kind: 'absolute-path', snippet: match[0] });
      }
    }
  }

  return out;
}

/** @returns {string[]} every file under dir, recursively, as paths relative to dir */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

const SCANNED_EXT = new Set(['.html', '.css', '.js']);

function main() {
  const distDir = process.argv[2] ?? 'dist';
  const files = walk(distDir).filter((f) => SCANNED_EXT.has(path.extname(f)));
  const violations = files.flatMap((f) =>
    findViolations(f, readFileSync(path.join(distDir, f), 'utf8')),
  );

  if (violations.length > 0) {
    console.error(`\nOffline gate FAILED — ${violations.length} violation(s):\n`);
    for (const v of violations) console.error(`  [${v.kind}] ${v.file}\n      ${v.snippet}`);
    console.error(
      '\nThe desktop build has no network and loads over file://.' +
        '\nBundle the dependency at build time instead of fetching it.\n',
    );
    process.exit(1);
  }
  console.log(`Offline gate passed (${files.length} files scanned).`);
}

// Only run the CLI when invoked directly, so tests can import findViolations.
// pathToFileURL is the reliable comparison on Windows: a raw import.meta.url
// pathname carries a leading slash (/C:/...) and will not match a plain path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/desktop-offline-gate.test.mjs`
Expected: PASS, 7 tests. The output must **not** contain "Offline gate passed" or a directory-scan error — either means the direct-invocation guard is wrong and `main()` ran on import.

- [ ] **Step 5: Confirm the gate is genuinely red on today's build**

Run: `npm run build && node scripts/check-offline.mjs`
Expected: FAIL, listing `fonts.googleapis.com` / `fonts.gstatic.com` and an absolute `/D1/` asset path. This proves the gate detects the two real defects Tasks 2 and 3 will fix. Record the violation count.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-offline.mjs tests/desktop-offline-gate.test.mjs
git commit -m "feat(build): offline gate detecting CDN deps and absolute asset paths"
```

---

### Task 2: Relative base path

**Files:**
- Modify: `vite.config.ts:8`

**Interfaces:**
- Consumes: `findViolations` CLI from Task 1 (for verification only).
- Produces: build output with relative asset paths. Task 4 relies on this — `file://` cannot resolve absolute paths.

**Context:** the comment directly above the line already reads *"Relative asset paths so the build runs from any subpath"*. The comment is correct; the value drifted to an absolute gh-pages path. This is a single-screen SPA with no router (no routing library in `package.json`), so relative paths resolve correctly under the gh-pages `/D1/` subpath, under itch.io's subpath, and under `file://`.

- [ ] **Step 1: Make the change**

In `vite.config.ts`, replace:

```ts
  // Relative asset paths so the build runs from any subpath (itch.io serves
  // HTML5 games from html.itch.zone/html/<id>/, not the domain root).
  base: '/D1/',
```

with:

```ts
  // Relative asset paths so the build runs from any subpath AND from file://
  // (the desktop shell loads dist/index.html directly). Covers itch.io, which
  // serves HTML5 games from html.itch.zone/html/<id>/, and the gh-pages /D1/
  // subpath. Never make this absolute — it breaks the desktop build silently.
  base: './',
```

- [ ] **Step 2: Rebuild and check the gate**

Run: `npm run build && node scripts/check-offline.mjs`
Expected: still FAIL, but **only** with `external-url` violations for `fonts.googleapis.com` / `fonts.gstatic.com`. Zero `absolute-path` violations. If any `absolute-path` violation remains, the base change did not take effect.

- [ ] **Step 3: Verify the web build still works from a subpath**

Run: `npx vite preview --outDir dist`
Open the printed URL. Expected: the game loads, art and styles render (fonts will still come from the CDN at this point — that is Task 3).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "fix(build): relative base so dist loads from file:// and any subpath"
```

---

### Task 3: Self-hosted fonts

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `src/main.tsx:1-7`
- Modify: `index.html:7-12`

**Interfaces:**
- Consumes: nothing.
- Produces: a `dist` with zero external URLs, which is the precondition for Task 6's `build:desktop` gate passing.

**Context:** `index.html` currently loads four families from the CDN. Offline they all fall back and the pixel-art UI breaks — and `LoadingScreen.tsx:52`'s `document.fonts.ready` resolves even when loading fails, so the game does not hang, it breaks silently.

The four families and the exact weights currently requested by the CDN link:

| Family | Weights | fontsource package |
|---|---|---|
| Baloo 2 | 500, 600, 700 | `@fontsource/baloo-2` |
| Jersey 10 | 400 (single weight) | `@fontsource/jersey-10` |
| Jost | 300, 500, 700, 900 + italic 300 | `@fontsource/jost` |
| Noto Sans KR | 500, 700 | `@fontsource/noto-sans-kr` |

All four packages exist at version 5.3.0 and all four families are SIL OFL, so redistribution is permitted. These are **runtime** dependencies (they ship in the bundle), so install them into `dependencies`, not `devDependencies`.

- [ ] **Step 1: Install the packages**

```bash
npm install @fontsource/baloo-2 @fontsource/jersey-10 @fontsource/jost @fontsource/noto-sans-kr
```

- [ ] **Step 2: Confirm the exact CSS filenames exist**

```bash
ls node_modules/@fontsource/baloo-2/*.css node_modules/@fontsource/jersey-10/*.css node_modules/@fontsource/jost/*.css node_modules/@fontsource/noto-sans-kr/*.css
```

Expected: files named by weight (`500.css`, `700.css`, …) and italics as `<weight>-italic.css`.

**Decision rule:** if `node_modules/@fontsource/jost/300-italic.css` is absent, omit that one import in Step 3 and note it in the commit message — Jost italic is used in only one declaration and degrades to a synthesised oblique. Every other file in the table must exist; if one is missing, stop and report rather than guessing a substitute.

- [ ] **Step 3: Add the imports**

In `src/main.tsx`, insert these lines immediately **before** the existing `./ui/styles/tokens.css` import (fonts first, so `@font-face` rules precede the rules that use them):

```ts
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/jersey-10/400.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/300-italic.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/700.css';
import '@fontsource/jost/900.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
```

- [ ] **Step 4: Remove the CDN tags**

In `index.html`, delete lines 7–12 — both `<link rel="preconnect">` tags and the `<link ... fonts.googleapis.com ... rel="stylesheet" />`. The `<head>` should retain only `<meta charset>`, `<meta name="viewport">`, and `<title>`.

- [ ] **Step 5: Rebuild and verify the gate now passes**

Run: `npm run build && node scripts/check-offline.mjs`
Expected: `Offline gate passed (N files scanned).` — exit code 0. This is the first green gate.

- [ ] **Step 6: Verify fonts render with the network off**

Run: `npx vite preview --outDir dist`, open the URL, then **disable the network adapter** and hard-reload.
Expected: the readout numbers still use Jersey 10 (a distinctive condensed pixel face, not a generic sans), buttons use Baloo 2, and Korean text renders without tofu (▯). Switch the language to 한국어 and confirm.

**If the guided intro hard-locks the board and blocks inspection**, set the skip flag in DevTools before reloading: `localStorage.setItem('wj.tutorialIntro','1')`.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS. No test touches fonts, so this is a regression check on the `main.tsx` edit.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/main.tsx index.html
git commit -m "feat(build): self-host fonts, remove Google Fonts CDN dependency"
```

---

### Task 4: Electron shell

**Files:**
- Create: `desktop/main.js`
- Modify: `package.json` (devDependencies, `main` field, `desktop:run` script)

**Interfaces:**
- Consumes: `dist/index.html` produced by `npm run build` with a relative base (Task 2).
- Produces: an Electron app that Task 5 extends with window-state persistence. `main.js` must expose no exports — it is an entry point.

**Context:** Window sizing is deliberately naive in this task (a fixed default) so that launching can be verified in isolation. Task 5 replaces the hard-coded bounds with the persisted, display-validated ones.

- [ ] **Step 1: Install Electron**

```bash
npm install --save-dev electron electron-builder
```

- [ ] **Step 2: Add the `main` field and the run script**

In `package.json`, add a top-level `"main": "desktop/main.js"` (place it after `"type"`), and add to `scripts`:

```json
"desktop:run": "electron ."
```

`desktop:run` deliberately does **not** rebuild — it runs against the existing `dist/`, which is the fast loop for editing shell code.

- [ ] **Step 3: Write the main process**

Create `desktop/main.js`:

```js
/**
 * Electron main process.
 *
 * Opens one window and loads the built web app over file://. Imports NO game
 * code — the dependency direction is one-way (desktop/ -> dist/). Game rules
 * and UI policy do not belong here.
 *
 * The board scales itself: src/ui/styles/tokens.css computes --fit-scale from
 * the viewport against a 1440x912 design board, capped at 1. So this file only
 * chooses window sizes; it never touches layout.
 */
import { app, BrowserWindow, Menu, globalShortcut, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** localStorage lives in %APPDATA%/<appName>/. Renaming this orphans every save. */
app.setName('Play the World');

/** Design board is 1440x912; at this size --fit-scale reads exactly 1 (it is min(1, ...)). */
const DEFAULT_SIZE = { width: 1600, height: 1000 };
/** Below this --fit-scale bottoms out near 0.66 and the pixel font stops being legible. */
const MIN_SIZE = { width: 960, height: 600 };

/** Matches the game's dark background so no white flash shows before first paint. */
const BACKGROUND = '#141018';

function createWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    width: Math.min(DEFAULT_SIZE.width, workAreaSize.width),
    height: Math.min(DEFAULT_SIZE.height, workAreaSize.height),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    useContentSize: true,
    backgroundColor: BACKGROUND,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Without this a File/Edit/View menu appears and hands players Ctrl+R and DevTools.
  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(DIR, '..', 'dist', 'index.html'));

  return win;
}

app.whenReady().then(() => {
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

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 4: Launch and verify**

Run: `npm run build && npm run desktop:run`

Expected, all of which must hold:
1. A window opens at 1600×1000 (or the work area, if smaller) with **no white flash** — the dark background shows first.
2. The game renders: art, styles, and all four fonts.
3. **No menu bar.**
4. A blind can be played — submit a word and see it score.
5. `F11` toggles fullscreen and back.
6. `Ctrl+Shift+I` opens DevTools (unpackaged, so this is expected here).

If the window is blank, open DevTools and check the console: failed asset loads mean Task 2's base change is not in the current `dist` — rebuild.

- [ ] **Step 5: Verify the save location**

With the app running, play far enough to change state (start a run), quit, and relaunch.
Expected: the run is still there. Confirm the directory exists:

```bash
ls "$APPDATA/Play the World"
```

Expected: a `Local Storage` directory. **If the directory is named anything else, stop** — `app.setName` is not taking effect early enough, and fixing it after release would orphan saves.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json desktop/main.js
git commit -m "feat(desktop): Electron shell loading the built app offline"
```

---

### Task 5: Window state persistence

**Files:**
- Create: `desktop/window-state.js`
- Test: `tests/desktop-window-state.test.mjs`
- Modify: `desktop/main.js`

**Interfaces:**
- Consumes: `DEFAULT_SIZE` / `MIN_SIZE` semantics from Task 4 (redefined here as the authoritative source; Task 4's local constants are removed).
- Produces:
  - `DEFAULT_SIZE: { width: 1600, height: 1000 }`
  - `MIN_SIZE: { width: 960, height: 600 }`
  - `defaultBounds(workArea: Rect) => Rect` — centred, clamped to the work area
  - `isVisibleOn(bounds: Rect, displays: {workArea: Rect}[]) => boolean`
  - `restoreBounds(saved: Saved|null, displays: {workArea: Rect}[], workArea: Rect) => Rect`
  - `loadState(file: string) => Saved|null`, `saveState(file: string, state: Saved) => void`

  where `Rect = { x: number, y: number, width: number, height: number }` and
  `Saved = { x: number, y: number, width: number, height: number, maximized: boolean, fullScreen: boolean }`.

**Why this is split from Task 4:** the bounds logic is pure and is the one part of the shell worth testing. Restoring a window onto a monitor that has since been unplugged is a classic bug that manual testing rarely catches.

- [ ] **Step 1: Write the failing test**

Create `tests/desktop-window-state.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIZE,
  MIN_SIZE,
  defaultBounds,
  isVisibleOn,
  restoreBounds,
} from '../desktop/window-state.js';

const BIG = { x: 0, y: 0, width: 2560, height: 1440 };
const LAPTOP = { x: 0, y: 0, width: 1366, height: 768 };

describe('defaultBounds', () => {
  it('uses the default size on a large work area', () => {
    const b = defaultBounds(BIG);
    expect(b.width).toBe(DEFAULT_SIZE.width);
    expect(b.height).toBe(DEFAULT_SIZE.height);
  });

  it('centres the window in the work area', () => {
    const b = defaultBounds(BIG);
    expect(b.x).toBe((2560 - DEFAULT_SIZE.width) / 2);
    expect(b.y).toBe((1440 - DEFAULT_SIZE.height) / 2);
  });

  it('clamps to the work area on a small laptop so the window is never off-screen', () => {
    const b = defaultBounds(LAPTOP);
    expect(b.width).toBe(1366);
    expect(b.height).toBe(768);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
  });

  it('never returns bounds smaller than the minimum size', () => {
    const b = defaultBounds({ x: 0, y: 0, width: 640, height: 400 });
    expect(b.width).toBe(MIN_SIZE.width);
    expect(b.height).toBe(MIN_SIZE.height);
  });
});

describe('isVisibleOn', () => {
  const displays = [{ workArea: LAPTOP }];

  it('accepts a window inside the display', () => {
    expect(isVisibleOn({ x: 100, y: 100, width: 800, height: 600 }, displays)).toBe(true);
  });

  it('rejects a window entirely off the display (unplugged second monitor)', () => {
    expect(isVisibleOn({ x: 2000, y: 100, width: 800, height: 600 }, displays)).toBe(false);
  });

  it('rejects a window overlapping by only a sliver', () => {
    expect(isVisibleOn({ x: 1356, y: 100, width: 800, height: 600 }, displays)).toBe(false);
  });

  it('accepts a window straddling two displays', () => {
    const two = [{ workArea: LAPTOP }, { workArea: { x: 1366, y: 0, width: 1920, height: 1080 } }];
    expect(isVisibleOn({ x: 1300, y: 100, width: 800, height: 600 }, two)).toBe(true);
  });
});

describe('restoreBounds', () => {
  const displays = [{ workArea: LAPTOP }];

  it('falls back to defaults when nothing is saved', () => {
    expect(restoreBounds(null, displays, LAPTOP)).toEqual(defaultBounds(LAPTOP));
  });

  it('restores saved bounds that are still visible', () => {
    const saved = { x: 50, y: 60, width: 1000, height: 700, maximized: false, fullScreen: false };
    expect(restoreBounds(saved, displays, LAPTOP)).toEqual({ x: 50, y: 60, width: 1000, height: 700 });
  });

  it('falls back to defaults when the saved display is gone', () => {
    const saved = { x: 3000, y: 60, width: 1000, height: 700, maximized: false, fullScreen: false };
    expect(restoreBounds(saved, displays, LAPTOP)).toEqual(defaultBounds(LAPTOP));
  });

  it('raises a saved size below the minimum up to the minimum', () => {
    const saved = { x: 0, y: 0, width: 400, height: 300, maximized: false, fullScreen: false };
    const b = restoreBounds(saved, displays, LAPTOP);
    expect(b.width).toBe(MIN_SIZE.width);
    expect(b.height).toBe(MIN_SIZE.height);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/desktop-window-state.test.mjs`
Expected: FAIL — cannot resolve `../desktop/window-state.js`.

- [ ] **Step 3: Write the implementation**

Create `desktop/window-state.js`:

```js
/**
 * Window bounds policy and persistence.
 *
 * The exported geometry functions are pure so they can be tested without
 * Electron — restoring a window onto a monitor that has since been unplugged is
 * a bug manual testing rarely catches.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Design board is 1440x912; at this size --fit-scale reads exactly 1 (it is min(1, ...)). */
export const DEFAULT_SIZE = { width: 1600, height: 1000 };
/** Below this --fit-scale bottoms out near 0.66 and the pixel font stops being legible. */
export const MIN_SIZE = { width: 960, height: 600 };

/** A window must show at least this much of itself on some display to count as visible. */
const MIN_VISIBLE = { width: 120, height: 60 };

/**
 * @param {{x:number,y:number,width:number,height:number}} workArea
 * @returns {{x:number,y:number,width:number,height:number}}
 */
export function defaultBounds(workArea) {
  const width = Math.max(MIN_SIZE.width, Math.min(DEFAULT_SIZE.width, workArea.width));
  const height = Math.max(MIN_SIZE.height, Math.min(DEFAULT_SIZE.height, workArea.height));
  return {
    x: workArea.x + Math.max(0, Math.round((workArea.width - width) / 2)),
    y: workArea.y + Math.max(0, Math.round((workArea.height - height) / 2)),
    width,
    height,
  };
}

function overlap(a, b) {
  return {
    width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  };
}

/**
 * @param {{x:number,y:number,width:number,height:number}} bounds
 * @param {{workArea:{x:number,y:number,width:number,height:number}}[]} displays
 */
export function isVisibleOn(bounds, displays) {
  return displays.some((d) => {
    const o = overlap(bounds, d.workArea);
    return o.width >= MIN_VISIBLE.width && o.height >= MIN_VISIBLE.height;
  });
}

/**
 * @param {{x:number,y:number,width:number,height:number}|null} saved
 * @param {{workArea:{x:number,y:number,width:number,height:number}}[]} displays
 * @param {{x:number,y:number,width:number,height:number}} workArea primary work area
 */
export function restoreBounds(saved, displays, workArea) {
  if (!saved) return defaultBounds(workArea);

  const bounds = {
    x: saved.x,
    y: saved.y,
    width: Math.max(MIN_SIZE.width, saved.width),
    height: Math.max(MIN_SIZE.height, saved.height),
  };

  return isVisibleOn(bounds, displays) ? bounds : defaultBounds(workArea);
}

/** @returns {object|null} null when the file is missing or corrupt — never throws. */
export function loadState(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Best-effort; a failed write must never prevent the app from quitting. */
export function saveState(file, state) {
  try {
    writeFileSync(file, JSON.stringify(state), 'utf8');
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/desktop-window-state.test.mjs`
Expected: PASS, 12 tests.

- [ ] **Step 5: Wire it into the main process**

In `desktop/main.js`: delete the local `DEFAULT_SIZE` and `MIN_SIZE` constants, and add the import and persistence wiring. The file becomes:

```js
/**
 * Electron main process.
 *
 * Opens one window and loads the built web app over file://. Imports NO game
 * code — the dependency direction is one-way (desktop/ -> dist/). Game rules
 * and UI policy do not belong here.
 *
 * The board scales itself: src/ui/styles/tokens.css computes --fit-scale from
 * the viewport against a 1440x912 design board, capped at 1. So this file only
 * chooses window sizes; it never touches layout.
 */
import { app, BrowserWindow, Menu, globalShortcut, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_SIZE, loadState, restoreBounds, saveState } from './window-state.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** localStorage lives in %APPDATA%/<appName>/. Renaming this orphans every save. */
app.setName('Play the World');

/** Matches the game's dark background so no white flash shows before first paint. */
const BACKGROUND = '#141018';

function createWindow() {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const saved = loadState(stateFile);
  const bounds = restoreBounds(saved, screen.getAllDisplays(), screen.getPrimaryDisplay().workArea);

  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    useContentSize: true,
    backgroundColor: BACKGROUND,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Without this a File/Edit/View menu appears and hands players Ctrl+R and DevTools.
  Menu.setApplicationMenu(null);

  if (saved?.maximized) win.maximize();
  if (saved?.fullScreen) win.setFullScreen(true);

  // Persist on close rather than on every resize: getNormalBounds() returns the
  // restored (un-maximized) bounds, so a maximized window still remembers its
  // real size for when it is restored.
  win.on('close', () => {
    saveState(stateFile, {
      ...win.getNormalBounds(),
      maximized: win.isMaximized(),
      fullScreen: win.isFullScreen(),
    });
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(DIR, '..', 'dist', 'index.html'));

  return win;
}

app.whenReady().then(() => {
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

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 6: Verify persistence manually**

Run: `npm run desktop:run`
1. Resize the window to something distinctive and move it, then quit.
2. Relaunch. Expected: same size and position.
3. Maximize, quit, relaunch. Expected: opens maximized.
4. Enter fullscreen with `F11`, quit, relaunch. Expected: opens fullscreen; `F11` exits to the remembered windowed size.
5. Confirm `window-state.json` exists: `cat "$APPDATA/Play the World/window-state.json"`

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add desktop/window-state.js desktop/main.js tests/desktop-window-state.test.mjs
git commit -m "feat(desktop): persist and validate window bounds across launches"
```

---

### Task 6: Icon, packaging config, and the wired build

**Files:**
- Create: `scripts/make-icon.mjs`
- Create: `desktop/icon.ico` (generated, committed)
- Modify: `package.json` (`build` config, `build:desktop` script)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `desktop/main.js` (Task 4/5) as the packaged entry point; `scripts/check-offline.mjs` (Task 1) as the gate.
- Produces: `release/win-unpacked/` — the Steam depot content.

**Why hand-roll the icon:** a `.ico` is an `ICONDIR` header plus per-size entries, and since Windows Vista each entry may hold raw PNG bytes. `pngjs` is already a devDependency, so no new dependency is needed. The source is `src/ui/assets/woodak.png` at 1024×1054 — **not square**, so it is padded with transparency to 1054×1054 before scaling. Downscaling uses box averaging rather than nearest-neighbour: at a >4× reduction nearest-neighbour drops most source pixels and produces a speckled icon.

The final store icon is out of scope — this is explicitly interim.

- [ ] **Step 1: Write the icon generator**

Create `scripts/make-icon.mjs`:

```js
/**
 * Generate desktop/icon.ico from a source PNG.
 *
 * INTERIM ICON. The final store icon is an art-direction decision, not a
 * packaging task — see docs/superpowers/specs/2026-07-29-desktop-packaging-design.md.
 *
 * A .ico is an ICONDIR header plus one ICONDIRENTRY per size; since Vista each
 * entry may carry raw PNG bytes, so pngjs (already a devDependency) is enough.
 *
 * Usage: node scripts/make-icon.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const SOURCE = 'src/ui/assets/woodak.png';
const OUTPUT = 'desktop/icon.ico';
/** electron-builder requires a 256px entry; the smaller ones are for the taskbar and Explorer. */
const SIZES = [16, 32, 48, 256];

/** Pad to a centred square with transparency — the source is 1024x1054. */
function toSquare(src) {
  const side = Math.max(src.width, src.height);
  if (side === src.width && side === src.height) return src;

  const out = new PNG({ width: side, height: side });
  out.data.fill(0);
  const dx = Math.floor((side - src.width) / 2);
  const dy = Math.floor((side - src.height) / 2);

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4;
      const d = ((y + dy) * side + (x + dx)) * 4;
      src.data.copy(out.data, d, s, s + 4);
    }
  }
  return out;
}

/** Box-average downscale. Nearest-neighbour speckles badly at a >4x reduction. */
function resize(src, size) {
  const out = new PNG({ width: size, height: size });
  const ratio = src.width / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * ratio);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * ratio));
      const y0 = Math.floor(y * ratio);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ratio));

      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) * 4;
          const alpha = src.data[i + 3];
          // Weight colour by alpha so transparent pixels do not wash out the edges.
          r += src.data[i] * alpha;
          g += src.data[i + 1] * alpha;
          b += src.data[i + 2] * alpha;
          a += alpha;
          n++;
        }
      }

      const d = (y * size + x) * 4;
      out.data[d] = a > 0 ? Math.round(r / a) : 0;
      out.data[d + 1] = a > 0 ? Math.round(g / a) : 0;
      out.data[d + 2] = a > 0 ? Math.round(b / a) : 0;
      out.data[d + 3] = Math.round(a / n);
    }
  }
  return out;
}

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;

  pngBuffers.forEach(({ size, data }, i) => {
    const e = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, e); // 0 means 256
    entries.writeUInt8(size >= 256 ? 0 : size, e + 1);
    entries.writeUInt8(0, e + 2); // palette count
    entries.writeUInt8(0, e + 3); // reserved
    entries.writeUInt16LE(1, e + 4); // colour planes
    entries.writeUInt16LE(32, e + 6); // bits per pixel
    entries.writeUInt32LE(data.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });

  return Buffer.concat([header, entries, ...pngBuffers.map((p) => p.data)]);
}

const source = toSquare(PNG.sync.read(readFileSync(SOURCE)));
const images = SIZES.map((size) => ({ size, data: PNG.sync.write(resize(source, size)) }));
writeFileSync(OUTPUT, buildIco(images));
console.log(`Wrote ${OUTPUT} (${SIZES.join(', ')}px) from ${SOURCE}`);
```

- [ ] **Step 2: Generate and inspect the icon**

```bash
node scripts/make-icon.mjs
```

Expected: `desktop/icon.ico` is created. Open it in Windows Explorer (set the view to Large Icons) and confirm the mascot is recognisable and not speckled or clipped. If the padding is off, the mascot will sit off-centre — fix `toSquare` before continuing.

- [ ] **Step 3: Add the electron-builder config**

In `package.json`, add a top-level `build` object:

```json
"build": {
  "appId": "com.kdg0711.playtheworld",
  "productName": "Play the World",
  "directories": { "output": "release" },
  "files": ["dist/**/*", "desktop/**/*", "package.json"],
  "asar": true,
  "win": {
    "target": "dir",
    "icon": "desktop/icon.ico"
  }
}
```

`"target": "dir"` produces `release/win-unpacked/` and no installer — Steam copies a depot folder and runs the exe, so NSIS/MSI would be built and verified for nothing.

- [ ] **Step 4: Add the build script**

In `package.json` `scripts`, add:

```json
"build:desktop": "npm run build && node scripts/check-offline.mjs && electron-builder --dir"
```

The gate sits between the build and the packaging step so a network dependency fails the build instead of shipping.

- [ ] **Step 5: Ignore the release directory**

In `.gitignore`, under the `# --- Build output ---` section, add `release/` on the line after `build/`.

- [ ] **Step 6: Run the packaged build**

Run: `npm run build:desktop`

Expected: the offline gate prints "Offline gate passed", electron-builder completes, and `release/win-unpacked/` exists containing `Play the World.exe`.

```bash
ls release/win-unpacked/
```

- [ ] **Step 7: Verify the gate actually blocks a regression**

Temporarily re-add a CDN link to `index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Jost" rel="stylesheet" />
```

Run: `npm run build:desktop`
Expected: **FAILS** at the gate with an `external-url` violation, and `electron-builder` never runs.

Then revert the change (`git checkout index.html`) and re-run `npm run build:desktop` to confirm it passes again. **Do not commit with the CDN link in place.**

- [ ] **Step 8: Run the packaged executable**

Run: `"./release/win-unpacked/Play the World.exe"`

Expected: the game launches, no menu bar, correct icon in the taskbar, and **`Ctrl+Shift+I` does nothing** (`app.isPackaged` is true here, unlike under `desktop:run`).

- [ ] **Step 9: Commit**

```bash
git add scripts/make-icon.mjs desktop/icon.ico package.json package-lock.json .gitignore
git commit -m "feat(desktop): packaging config, interim icon, gated build:desktop"
```

---

### Task 7: Full offline verification and the documentation rule

The manual checklist is the real test for a shell, and the documentation rule is what keeps the build working as the game changes. Both are deliverables, not paperwork.

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `release/win-unpacked/` from Task 6.
- Produces: nothing consumed by later tasks — this is the final task.

**Why both files:** `CLAUDE.md` is listed in `.gitignore` and is therefore absent from the shared repository. `AGENTS.md` is the tracked mirror. The rule must be in both or it is lost for everyone else.

- [ ] **Step 1: Run the full manual verification checklist**

Every item must pass. Run against the **packaged** executable at `release/win-unpacked/"Play the World.exe"`, not `desktop:run`.

1. **Disable the network adapter**, launch, and play through a full blind clear. All four fonts render correctly (Jersey 10 on the numeric readouts is the most obvious tell) and Korean text has no tofu (▯) after switching to 한국어.
2. Quit and relaunch. In-progress run, collection, unlocks, and settings all persist. Confirm `%APPDATA%/Play the World/Local Storage` exists.
3. Resize the window from large to small. The board scales without scrollbars and stops shrinking at 960×600.
4. Set the display to 150% Windows scaling, relaunch, and confirm the layout is correct with no scrollbars.
5. Maximize on a secondary monitor, quit, disconnect that monitor, relaunch. The window appears on the primary display.
6. `F11` toggles fullscreen. No menu bar. `Ctrl+R` and `Ctrl+Shift+I` do nothing.

Record any failure and fix it before proceeding — do not document a rule for a build that does not pass.

- [ ] **Step 2: Add the rule to `AGENTS.md`**

Add this bullet to the "Key rules easy to get wrong" list:

```markdown
- **The desktop build has no network and loads over `file://` (desktop packaging, 2026-07-29):** the game ships as an Electron app (`desktop/`, Windows, Steam-bound) that loads `dist/index.html` directly. Three kinds of change work perfectly in a browser and break **only** on desktop, so they are invisible during development: (a) a new CDN dependency — a font, script, or remote image; (b) loading data with a runtime `fetch()` — the dictionary and lexicon are bundled at build time via `?raw`/JSON imports in `src/ui/lexicon.browser.ts` and must stay that way; (c) making Vite's `base` absolute again — it is `'./'` and must stay relative so the same build runs from `file://`, the gh-pages `/D1/` subpath, and itch.io. `scripts/check-offline.mjs` (run by `build:desktop`) catches (a) and (c) automatically; (b) is on you. **The Electron app name `Play the World` (`app.setName` in `desktop/main.js`) must never change** — localStorage lives in `%APPDATA%/<appName>/`, so renaming it orphans every player's save. `desktop/` imports no game code; the dependency direction is one-way (`desktop/ → dist/`).
```

- [ ] **Step 3: Mirror the rule into `CLAUDE.md`**

Add the identical bullet to the same list in `CLAUDE.md`. The two files are mirrors; a rule in only one of them will drift.

- [ ] **Step 4: Verify the two files agree**

```bash
diff <(grep -A2 "desktop build has no network" AGENTS.md) <(grep -A2 "desktop build has no network" CLAUDE.md)
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs: rule keeping the desktop build offline-capable"
```

Note: `CLAUDE.md` is gitignored, so `git add` on it will be a no-op unless forced. That is expected — the tracked copy is `AGENTS.md`, and the local `CLAUDE.md` edit still needs to happen for this session's tooling. If `git add CLAUDE.md` errors, drop it from the command and commit `AGENTS.md` alone.

---

## Out of scope — the remaining Steam cells

These are **not** part of this plan and each needs its own spec:

2. File-based saves (prerequisite for Steam Cloud)
3. Steamworks integration (achievements, cloud, overlay)
4. Build/submit pipeline (code signing, `steamcmd` upload, branches)
5. Asset optimization (63MB `dist`; pack and boss PNGs at 1.6–1.9MB each)

Also out of scope: installers, macOS/Linux targets, and the final store icon art.
